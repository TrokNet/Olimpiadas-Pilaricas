import json
import tempfile
import time
import unittest
from pathlib import Path
import os, socket, subprocess, sys, urllib.request, urllib.error, http.cookiejar
class Reply:
    def __init__(self,status,body,headers):self.status_code=status;self.text=body.decode();self.headers=headers
    def json(self):return json.loads(self.text)
class Client:
    def __init__(self,base):
        self.base=base;self.cookies=http.cookiejar.CookieJar();self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies));self.counter=0
    def call(self,method,path,json=None,headers=None):
        self.counter+=1
        req=urllib.request.Request(self.base+path,data=__import__('json').dumps(json).encode() if json is not None else b'' if method=='POST' else None,method=method,headers={'Content-Type':'application/json','CF-Connecting-IP':f'192.0.2.{self.counter}',**(headers or {})})
        try:
            with self.opener.open(req,timeout=10) as r:return Reply(r.status,r.read(),r.headers)
        except urllib.error.HTTPError as e:return Reply(e.code,e.read(),e.headers)
    def get(self,path):return self.call('GET',path)
    def post(self,path,**kwargs):return self.call('POST',path,**kwargs)
    def put(self,path,**kwargs):return self.call('PUT',path,**kwargs)

from sqlalchemy import select, func
from sqlalchemy.orm import Session
from backend.database import ROOT, engine_for, Account, LoginSession, MatchResult, ResultAudit
from scripts.import_excel import import_excel
from scripts.provision_accounts import provision
import backend.auth as auth

class AccountPermissionsTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.engine=engine_for('sqlite:///'+str(Path(self.tmp.name)/'auth.db'))
        import_excel(ROOT/'data/olimpiadas.xlsx',self.engine)
        self.export=Path(self.tmp.name)/'private.csv'
        self.assertEqual(provision(self.engine,self.export),16)
        import csv
        with self.export.open(encoding='utf-8-sig') as file:
            self.credentials={row['usuario']:row['contrasena'] for row in csv.DictReader(file)}
        with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
        self.client=Client(f'http://127.0.0.1:{port}')
        self.server=subprocess.Popen([sys.executable,'-m','uvicorn','backend.public_preview:app','--host','127.0.0.1','--port',str(port),'--no-access-log'],cwd=ROOT,env={**os.environ,'DATABASE_URL':str(self.engine.url)},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        for _ in range(80):
            try:
                if self.client.get('/api/tournament').status_code==200:break
            except (urllib.error.URLError,TimeoutError):time.sleep(.1)
        else:
            self.server.terminate();raise RuntimeError('Servidor de prueba no disponible')
        self.data=self.client.get('/api/tournament').json()
    def tearDown(self):
        if os.name=='nt':subprocess.run(['taskkill','/PID',str(self.server.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        else:self.server.terminate()
        self.server.communicate(timeout=10);self.engine.dispose()
        import gc
        gc.collect()
        self.tmp.cleanup()
    def login(self,username):
        return self.client.post('/api/auth/login',json={'username':username,'password':self.credentials[username]})
    def match(self,grade,sport,own=True):
        entries={e['id'] for e in self.data['entries'] if e['grade_id']==grade}
        return next(m for m in self.data['matches'] if m['sport']==sport and m['kind']=='OFICIAL' and m['home_id'] and m['away_id'] and (bool(entries.intersection([m['home_id'],m['away_id']]))==own))
    def rule(self,sport):
        return {'win':3,'draw':1,'loss':0,'allow_draw':sport.startswith('futbol'),'wo_win':3,'wo_loss':0,'wo_score_for':3 if sport.startswith('futbol') else 2 if sport.startswith('voley') else 20,'wo_score_against':0,'wo_set_points':25,'tiebreakers':['points','difference','for']}
    def setRules(self,sport):
        self.assertEqual(self.login('administrador').status_code,200)
        self.assertEqual(self.client.put('/api/rules/'+sport,json=self.rule(sport)).status_code,200)
        self.client.post('/api/auth/logout')
    def test_private_passwords_and_unique_accounts(self):
        self.assertEqual(len(set(self.credentials.values())),16)
        with Session(self.engine) as s:
            for account in s.scalars(select(Account)):
                self.assertNotEqual(account.password_hash,self.credentials[account.username]);self.assertEqual(len(account.password_hash),128)
        with self.assertRaises(ValueError):provision(self.engine,self.export)
        body=json.dumps(self.data)
        self.assertNotIn('password_hash',body)
        self.assertNotIn(self.credentials['administrador'],body)
    def test_login_logout_invalid_expired_and_cookie(self):
        self.assertEqual(self.client.post('/api/auth/login',json={'username':'administrador','password':'incorrect'}).status_code,401)
        response=self.login('cuarto-primaria');self.assertEqual(response.status_code,200)
        cookie=response.headers['set-cookie'].lower();self.assertIn('httponly',cookie);self.assertIn('samesite=strict',cookie)
        self.assertEqual(self.client.get('/api/tournament').json()['auth_user']['grade_id'],'cuarto-primaria')
        token=next(c.value for c in self.client.cookies if c.name==auth.COOKIE)
        with Session(self.engine) as s,s.begin():
            session=s.scalar(select(LoginSession));self.assertNotEqual(session.token_hash,token);session.expires_at=int(time.time())-1
        self.assertIsNone(self.client.get('/api/tournament').json()['auth_user'])
        self.login('cuarto-primaria');self.client.post('/api/auth/logout')
        self.assertIsNone(self.client.get('/api/tournament').json()['auth_user'])
    def test_grade_permissions_both_scores_all_disciplines_and_audit(self):
        for sport in ['futbol-masculino','voley-masculino','voley-femenino','basquet-masculino','basquet-femenino']:
            self.setRules(sport)
            own=self.match('cuarto-primaria',sport);other=self.match('cuarto-primaria',sport,False)
            self.assertEqual(self.client.put('/api/results/'+own['id'],json={'home_score':3,'away_score':1}).status_code,401)
            self.login('cuarto-primaria')
            payload={'home_score':3,'away_score':1,'home_yellow':1,'away_red':1}
            if sport.startswith('voley'):payload.update(sets=[{'home':25,'away':21},{'home':25,'away':18}])
            response=self.client.put('/api/results/'+own['id'],json=payload);self.assertEqual(response.status_code,200,response.text)
            self.assertEqual(response.json()['auth_user']['grade_id'],'cuarto-primaria')
            saved=next(m for m in response.json()['matches'] if m['id']==own['id'])
            self.assertEqual(saved['home_score'],2 if sport.startswith('voley') else 3);self.assertEqual(saved['away_score'],0 if sport.startswith('voley') else 1)
            self.assertEqual(self.client.put('/api/results/'+other['id'],json=payload).status_code,403)
            self.assertEqual(self.client.put('/api/rules/'+sport,json=self.rule(sport)).status_code,403)
            self.assertEqual(self.client.put('/api/results/'+own['id'],json=payload,headers={'Origin':'https://evil.example'}).status_code,403)
            self.client.post('/api/auth/logout')
        with Session(self.engine) as s:
            self.assertEqual(s.scalar(select(func.count()).select_from(ResultAudit)),5)
            self.assertEqual(set(s.scalars(select(ResultAudit.username))),{'cuarto-primaria'})
    def test_admin_can_write_other_teams_and_walkover(self):
        self.setRules('basquet-femenino');self.login('administrador')
        m=self.match('ex-alumnas','basquet-femenino')
        r=self.client.put('/api/results/'+m['id'],json={'home_score':0,'away_score':0,'walkover':'home'})
        self.assertEqual(r.status_code,200,r.text)
        saved=next(g for g in r.json()['matches'] if g['id']==m['id'])
        self.assertEqual((saved['home_score'],saved['away_score']),(0,20))
        with Session(self.engine) as s:self.assertEqual(s.get(MatchResult,m['id']).sport,'basquet-femenino')

if __name__=='__main__':unittest.main()
