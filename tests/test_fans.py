import json
import gc
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
from backend.database import ROOT, engine_for, FanMessage
from scripts.import_excel import import_excel
from scripts.configure_fans_admin import set_password
from scripts.migrate_database import migrate
from sqlalchemy.orm import Session
from sqlalchemy import select,func

class FansApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory()
        cls.url='sqlite:///'+(Path(cls.tmp.name)/'fans.db').as_posix()
        engine=engine_for(cls.url);import_excel(ROOT/'data/olimpiadas.xlsx',engine);engine.dispose()
        config=Path(cls.tmp.name)/'private.json';set_password('test-key-only',config)
        with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
        cls.base=f'http://127.0.0.1:{port}'
        cls.server=subprocess.Popen([sys.executable,'-m','uvicorn','backend.public_preview:app','--host','127.0.0.1','--port',str(port)],cwd=ROOT,env={**os.environ,'DATABASE_URL':cls.url,'FANS_ADMIN_CONFIG':str(config)},stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
        for _ in range(60):
            try:
                with urllib.request.urlopen(cls.base+'/api/fans',timeout=1):break
            except (urllib.error.URLError,TimeoutError):time.sleep(.1)
        else:
            cls.server.terminate();raise RuntimeError(cls.server.communicate(timeout=5)[1].decode())

    @classmethod
    def tearDownClass(cls):cls.server.terminate();cls.server.communicate(timeout=10);cls.tmp.cleanup()

    def call(self,path,body=None,method='GET'):
        req=urllib.request.Request(self.base+path,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json'},method=method)
        with urllib.request.urlopen(req,timeout=5) as response:return json.load(response)

    def post(self,team='cuarto-primaria',text='¡Vamos, equipo!'):
        return self.call('/api/fans',{'team_id':team,'author':'  Familia  ','message':text},'POST')

    def test_history_filter_pagination_and_literal_text(self):
        first=self.post('3-anos','<script>alert(1)</script>')
        second=self.post('3-anos','Segundo aliento')
        page=self.call('/api/fans?team_id=3-anos&limit=1')
        self.assertEqual(page['messages'][0]['id'],second['id'])
        self.assertEqual(page['total'],2)
        older=self.call('/api/fans?team_id=3-anos&limit=1&cursor='+page['next_cursor'])
        self.assertEqual(older['messages'][0]['id'],first['id'])
        self.assertEqual(older['messages'][0]['message'],'<script>alert(1)</script>')
        self.assertEqual(first['author'],'Familia')

    def test_invalid_messages_do_not_persist(self):
        for body in [{'team_id':'unknown','message':'Hola'},{'team_id':'cuarto-primaria','message':'  '},{'team_id':'cuarto-primaria','message':'a'*501}]:
            with self.assertRaises(urllib.error.HTTPError) as failure:self.call('/api/fans',body,'POST')
            self.assertEqual(failure.exception.code,422)

    def test_delete_requires_key_and_does_not_return_it(self):
        posted=self.post()
        with self.assertRaises(urllib.error.HTTPError) as failure:self.call('/api/fans/'+posted['id'],{'password':'wrong'},'DELETE')
        self.assertEqual(failure.exception.code,403)
        self.assertTrue(any(m['id']==posted['id'] for m in self.call('/api/fans')['messages']))
        result=self.call('/api/fans/'+posted['id'],{'password':'test-key-only'},'DELETE')
        self.assertEqual(result,{'deleted':True})
        self.assertNotIn('test-key-only',json.dumps(self.call('/api/fans')))

    def test_public_preview_does_not_expose_results_write_or_secrets(self):
        self.assertFalse(self.call('/api/tournament')['capabilities']['result_write'])
        for path,method,body in [('/.local/fans_admin.json','GET',None),('/api/rules/futbol-masculino','PUT',{}),('/api/results/anything','PUT',{})]:
            with self.assertRaises(urllib.error.HTTPError) as failure:self.call(path,body,method)
            self.assertEqual(failure.exception.code,404 if path.startswith('/.local/') else 401)

    def test_fans_survive_reimport_and_portable_migration(self):
        item=self.post('ex-alumnas','¡Nuestra Señora del Pilar!')
        engine=engine_for(self.url);import_excel(ROOT/'data/olimpiadas.xlsx',engine)
        self.assertEqual(self.call('/api/fans?team_id=ex-alumnas')['messages'][0]['id'],item['id'])
        target='sqlite:///'+(Path(self.tmp.name)/'copy.db').as_posix()
        migrate(self.url,target)
        copied=engine_for(target)
        with Session(copied) as session:self.assertGreater(session.scalar(select(func.count()).select_from(FanMessage)),0)
        copied.dispose();engine.dispose();gc.collect()
