import json,tempfile,unittest
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.orm import Session
from backend.database import ROOT,engine_for,Match,Account,FanMessage,MatchResult
from scripts.import_excel import import_excel
from scripts.apply_schedule_updates import apply_updates,PATCH
from scripts.export_data import dataset
class ScheduleUpdatesTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.engine=engine_for('sqlite:///'+(Path(self.tmp.name)/'schedule.db').as_posix());import_excel(ROOT/'data/olimpiadas.xlsx',self.engine)
    def tearDown(self):
        self.engine.dispose()
        import gc
        gc.collect();self.tmp.cleanup()
    def test_all_reviewed_schedules_and_stable_participants(self):
        patch=json.loads(PATCH.read_text(encoding='utf-8'));data=dataset(self.engine);matches={m['id']:m for m in data['matches']};entries={e['id']:e['grade_id'] for e in data['entries']}
        self.assertEqual(len(matches),162);self.assertEqual(len(patch['matches']),114)
        for row in patch['matches']:
            match=matches[row['id']]
            self.assertEqual([match[k] for k in ['date','start','end','court']],[row[k] for k in ['date','start','end','court']])
            self.assertEqual([entries[match['home_id']],entries[match['away_id']]],[row['home_grade_id'],row['away_grade_id']])
        self.assertEqual(apply_updates(self.engine)['changed'],0)
        self.assertEqual(len([m for m in data['matches'] if m['date']=='2026-11-08']),20)
        self.assertEqual(next(g for g in data['grades'] if g['id']=='ex-alumnas')['name'],'Nuestra Señora del Pilar')
        for m in data['matches']:
            if m.get('superseded_by'):
                self.assertEqual(m['kind'],'RESERVA')
                for mid in m['superseded_by']:
                    other=matches[mid];self.assertEqual(other['kind'],'OFICIAL');self.assertEqual((m['date'],m['court']),(other['date'],other['court']))
    def test_update_preserves_results_accounts_and_messages(self):
        row=json.loads(PATCH.read_text(encoding='utf-8'))['matches'][0]
        with Session(self.engine) as s,s.begin():
            m=s.get(Match,row['id']);m.start='08:00';m.end='08:35'
            s.add(Account(username='test-account',password_hash='not-a-production-password',salt='00'*16,role='team',grade_id='cuarto-primaria'))
            s.add(FanMessage(id='test-fan',team_id='cuarto-primaria',author='Prueba',message='Mensaje conservado',created_at='2026-10-26T00:00:00Z'))
            s.add(MatchResult(match_id=m.id,sport=m.sport,payload=json.dumps({'home_score':2,'away_score':1}),updated_at='2026-10-26T00:00:00Z'))
        self.assertEqual(apply_updates(self.engine)['changed'],1)
        with Session(self.engine) as s:
            self.assertEqual(s.get(Match,row['id']).start,row['start']);self.assertIsNotNone(s.get(Account,'test-account'));self.assertEqual(s.get(FanMessage,'test-fan').message,'Mensaje conservado');self.assertEqual(json.loads(s.get(MatchResult,row['id']).payload)['home_score'],2)
    def test_wrong_team_rolls_back_entire_update(self):
        before=dataset(self.engine)['matches'];patch=json.loads(PATCH.read_text(encoding='utf-8'));patch['matches'][0]['start']='08:00';patch['matches'][1]['home_grade_id']='ex-alumnas'
        path=Path(self.tmp.name)/'invalid.json';path.write_text(json.dumps(patch),encoding='utf-8')
        with self.assertRaisesRegex(ValueError,'mismos equipos'):apply_updates(self.engine,path)
        self.assertEqual(dataset(self.engine)['matches'],before)
if __name__=='__main__':unittest.main()
