import json,tempfile,unittest
from pathlib import Path
from uuid import uuid4
from datetime import datetime
from sqlalchemy import select,func
from sqlalchemy.orm import Session
from backend.database import engine_for,initialize,AnalyticsVisitor,Metadata
from backend.analytics import record_activity,statistics,lima_day
from scripts.import_access_history import import_history

class AudienceTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.engine=engine_for('sqlite:///'+str(Path(self.tmp.name)/'audience.db'));initialize(self.engine)
        self.now=int(datetime.fromisoformat('2026-10-28T12:00:00-05:00').timestamp());self.visitor=str(uuid4())
    def tearDown(self):
        self.engine.dispose();self.tmp.cleanup()
    def stats(self,now=None):return statistics(self.engine,'2026-10-22','2026-10-29',self.now if now is None else now)
    def test_tabs_reloads_and_return_visits(self):
        record_activity(self.engine,self.visitor,self.now)
        record_activity(self.engine,self.visitor,self.now+30)
        self.assertEqual(self.stats()['total_visitors'],1);self.assertEqual(self.stats()['total_visits'],1)
        self.assertEqual(self.stats(self.now+150)['online'],0)
        record_activity(self.engine,self.visitor,self.now+1830)
        self.assertEqual(self.stats()['total_visits'],2);self.assertEqual(self.stats()['total_visitors'],1)
        with Session(self.engine) as s:self.assertNotEqual(s.scalar(select(AnalyticsVisitor)).id,self.visitor)
    def test_two_devices_and_persistence(self):
        record_activity(self.engine,self.visitor,self.now);record_activity(self.engine,str(uuid4()),self.now)
        self.engine.dispose()
        self.assertEqual(self.stats()['online'],2);self.assertEqual(self.stats()['total_visitors'],2)
    def test_midnight_lima_does_not_start_an_extra_visit(self):
        now=int(datetime.fromisoformat('2026-10-28T23:59:50-05:00').timestamp())
        record_activity(self.engine,self.visitor,now);record_activity(self.engine,self.visitor,now+30)
        self.assertEqual(lima_day(now+30),'2026-10-29')
        daily={row['date']:row for row in self.stats(now+30)['history']}
        self.assertEqual(daily['2026-10-28']['visitors'],1);self.assertEqual(daily['2026-10-29']['visitors'],1)
        self.assertEqual(self.stats(now+30)['total_visits'],1);self.assertEqual(self.stats(now+30)['period_visitors'],1)
    def test_history_import_is_idempotent_and_not_people(self):
        rows=[]
        messages=['GET / HTTP/1.1" 200 OK','GET /?sport=voley HTTP/1.1" 200 OK','GET /api/tournament HTTP/1.1" 200 OK','GET / HTTP/1.1" 404 Not Found','POST / HTTP/1.1" 200 OK']
        for i,m in enumerate(messages):rows.append(json.dumps({'__REALTIME_TIMESTAMP':str((self.now-86400+i)*1000000),'MESSAGE':'INFO: 127.0.0.1:1 - "'+m}))
        rows+=['broken',json.dumps({'MESSAGE':'without timestamp'})]
        path=Path(self.tmp.name)/'journal.jsonl';path.write_text('\n'.join(rows),encoding='utf-8')
        self.assertEqual(import_history(self.engine,path),2);self.assertEqual(import_history(self.engine,path),0)
        self.assertEqual(self.stats()['recovered_accesses'],2);self.assertEqual(self.stats()['total_visitors'],0)
        self.assertEqual(self.stats()['total_visits'],0)
    def test_import_excludes_accesses_after_tracking_started(self):
        record_activity(self.engine,self.visitor,self.now)
        path=Path(self.tmp.name)/'journal.jsonl';path.write_text(json.dumps({'__REALTIME_TIMESTAMP':str((self.now+1)*1000000),'MESSAGE':'INFO: x - "GET / HTTP/1.1" 200 OK'}))
        self.assertEqual(import_history(self.engine,path),0)
