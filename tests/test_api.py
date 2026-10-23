import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.request
import urllib.error
from pathlib import Path
from backend.database import ROOT, engine_for
from scripts.import_excel import import_excel

class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory();url='sqlite:///'+(Path(cls.tmp.name)/'api.db').as_posix()
        cls.url=url
        engine=engine_for(url);import_excel(ROOT/'data/olimpiadas.xlsx',engine);engine.dispose()
        with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
        cls.base=f'http://127.0.0.1:{port}'
        cls.server=subprocess.Popen([sys.executable,'-m','uvicorn','backend.api:app','--host','127.0.0.1','--port',str(port)],cwd=ROOT,env={**os.environ,'DATABASE_URL':url},stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
        for _ in range(60):
            try:
                with urllib.request.urlopen(cls.base+'/api/tournament',timeout=1) as response:cls.data=json.load(response)
                break
            except (urllib.error.URLError,TimeoutError):time.sleep(.1)
        else:
            cls.server.terminate();stderr=cls.server.communicate(timeout=5)[1].decode();raise RuntimeError('API no disponible: '+stderr)
    @classmethod
    def tearDownClass(cls):cls.server.terminate();cls.server.communicate(timeout=10);cls.tmp.cleanup()
    def test_tournament_from_sqlite(self):self.assertEqual(len(self.data['matches']),162);self.assertEqual(len(self.data['entries']),68)
    def test_match_endpoint(self):
        m=self.data['matches'][0]
        with urllib.request.urlopen(self.base+'/api/matches/'+m['id']) as response:self.assertEqual(json.load(response)['id'],m['id'])
    def test_unknown_match_404(self):
        with self.assertRaises(urllib.error.HTTPError) as context:urllib.request.urlopen(self.base+'/api/matches/unknown')
        self.assertEqual(context.exception.code,404)

class ResultApiTests(ApiTests):
    def put(self,path,payload):
        request=urllib.request.Request(self.base+path,data=json.dumps(payload).encode(),headers={'Content-Type':'application/json'},method='PUT')
        with urllib.request.urlopen(request) as r:return json.load(r)
    def rule(self,sport):
        return {'win':3,'draw':1,'loss':0,'allow_draw':sport.startswith('futbol'),'wo_win':3,'wo_loss':0,'wo_score_for':3 if sport.startswith('futbol') else 2 if sport.startswith('voley') else 20,'wo_score_against':0,'wo_set_points':25,'tiebreakers':['points','difference','for']}
    def game(self,sport):return next(m for m in self.data['matches'] if m['sport']==sport and m['phase']=='GRUPO A' and m['home_id'] and m['away_id'])
    def test_write_requires_rules(self):
        m=self.game('basquet-femenino')
        with self.assertRaises(urllib.error.HTTPError) as c:self.put('/api/results/'+m['id'],{'home_score':1,'away_score':0})
        self.assertEqual(c.exception.code,422)
    def test_confirmed_walkovers_and_points(self):
        for sport,score,points in [('futbol-masculino',3,3),('voley-femenino',2,50),('basquet-masculino',20,20)]:
            self.put('/api/rules/'+sport,self.rule(sport));m=self.game(sport)
            data=self.put('/api/results/'+m['id'],{'home_score':0,'away_score':0,'walkover':'away'})
            saved=next(g for g in data['matches'] if g['id']==m['id'])['result']
            self.assertEqual((saved['home_score'],saved['away_score'],saved['home_points'],saved['away_points']),(score,0,points,0))
            self.assertEqual(data['rules'][sport]['wo_win'],3)
            if sport.startswith('voley'):self.assertEqual(saved['sets'],[{'home':25,'away':0},{'home':25,'away':0}])
    def test_goal_cards_persist_and_survive_excel_reimport(self):
        sport='futbol-masculino';self.put('/api/rules/'+sport,self.rule(sport));m=self.game(sport)
        self.put('/api/results/'+m['id'],{'home_score':4,'away_score':2,'home_yellow':3,'away_red':1})
        engine=engine_for(self.url);import_excel(ROOT/'data/olimpiadas.xlsx',engine)
        from scripts.export_data import dataset
        saved=next(g for g in dataset(engine)['matches'] if g['id']==m['id']);engine.dispose()
        self.assertEqual(saved['home_score'],4);self.assertEqual(saved['result']['home_yellow'],3);self.assertEqual(saved['result']['away_red'],1)
    def test_volley_uses_sets_not_total_points_for_winner(self):
        sport='voley-masculino';self.put('/api/rules/'+sport,self.rule(sport));m=self.game(sport)
        data=self.put('/api/results/'+m['id'],{'home_score':0,'away_score':0,'sets':[{'home':25,'away':23},{'home':0,'away':25},{'home':25,'away':23}]})
        saved=next(g for g in data['matches'] if g['id']==m['id'])['result']
        self.assertEqual((saved['home_score'],saved['away_score'],saved['home_points'],saved['away_points']),(2,1,50,71))
    def test_reject_invalid_results_and_origin(self):
        sport='futbol-masculino';self.put('/api/rules/'+sport,self.rule(sport));m=self.game(sport)
        for payload in [{'home_score':-1,'away_score':0},{'home_score':1.5,'away_score':0},{'home_score':1,'away_score':0,'home_red':-1}]:
            with self.assertRaises(urllib.error.HTTPError) as c:self.put('/api/results/'+m['id'],payload)
            self.assertEqual(c.exception.code,422)
        req=urllib.request.Request(self.base+'/api/results/'+m['id'],data=json.dumps({'home_score':1,'away_score':0}).encode(),method='PUT',headers={'Content-Type':'application/json','Origin':'https://example.org'})
        with self.assertRaises(urllib.error.HTTPError) as c:urllib.request.urlopen(req)
        self.assertEqual(c.exception.code,403)

if __name__=='__main__':unittest.main()
