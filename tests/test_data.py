import json
import tempfile
import unittest
from pathlib import Path
from openpyxl import load_workbook
from sqlalchemy import select,func
from sqlalchemy.orm import Session
from backend.database import ROOT,Grade,Entry,Match,engine_for
from scripts.import_excel import import_excel
from scripts.export_data import dataset
from scripts.manage_data import validate
from scripts.migrate_database import migrate

class DataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory();cls.engine=engine_for('sqlite:///'+(Path(cls.tmp.name)/'source.db').as_posix())
        cls.source=ROOT/'data/olimpiadas.xlsx';cls.stats=import_excel(cls.source,cls.engine)
    @classmethod
    def tearDownClass(cls): cls.engine.dispose();cls.tmp.cleanup()
    def test_source_complete(self):
        self.assertEqual(self.stats,{'grades':15,'entries':68,'matches':162});self.assertEqual(validate(self.engine),self.stats)
    def test_independent_correspondence(self):
        with Session(self.engine) as s:
            expected={'futbol-masculino':12,'voley-masculino':1,'voley-femenino':10,'basquet-masculino':12,'basquet-femenino':1}
            for sport,number in expected.items():self.assertEqual(s.get(Entry,f'{sport}:TEAM-{number}').grade_id,'cuarto-primaria')
            self.assertEqual(s.get(Entry,'voley-femenino:TEAM-12').grade_id,'segundo-secundaria')
    def test_corrected_names(self):
        with Session(self.engine) as s:
            for gid,name in {'5-anos':'Mont Peller','primero-primaria':'Espoleto','segundo-secundaria':'Monte Alvernia','primero-secundaria':'Iglesia San Damian'}.items():self.assertEqual(s.get(Grade,gid).name,name)
    def test_fonte_female_volleyball(self):
        with Session(self.engine) as s:
            eid='voley-femenino:TEAM-10';matches=list(s.scalars(select(Match).where((Match.home_id==eid)|(Match.away_id==eid)).order_by(Match.date)))
            self.assertEqual([(m.date,m.start,m.end) for m in matches],[('2026-10-31','12:30','13:20'),('2026-11-01','16:20','17:10'),('2026-11-07','15:25','16:15')])
            rivals=[s.get(Entry,m.away_id if m.home_id==eid else m.home_id).grade_id for m in matches]
            self.assertEqual(rivals,['cuarto-secundaria','segundo-secundaria','primero-primaria'])
    def test_basketball_two_fonte_matches(self):
        with Session(self.engine) as s:
            eid='basquet-masculino:TEAM-12';self.assertEqual(s.scalar(select(func.count()).select_from(Match).where((Match.home_id==eid)|(Match.away_id==eid))),2)
    def test_reserves_and_finals_preserved(self):
        d=dataset(self.engine);self.assertEqual(len([m for m in d['matches'] if m['date']=='2026-11-08']),20)
        self.assertTrue(any(m['kind']=='RESERVA' for m in d['matches']))
        self.assertTrue(all(m['home_score'] is None and m['away_score'] is None for m in d['matches']))
    def test_reimport_idempotent_and_stable(self):
        first=dataset(self.engine);import_excel(self.source,self.engine);second=dataset(self.engine)
        self.assertEqual(first['entries'],second['entries']);self.assertEqual(first['matches'],second['matches'])
    def invalid_workbook(self,field,value):
        target=Path(self.tmp.name)/'invalid.xlsx';wb=load_workbook(self.source);wb['Fixture web'][field]=value;wb.save(target);wb.close();return target
    def test_invalid_schedule_preserves_previous_database(self):
        bad=self.invalid_workbook('D6','08:00');before=dataset(self.engine)['matches']
        with self.assertRaisesRegex(ValueError,'Inicio'):import_excel(bad,self.engine)
        self.assertEqual(dataset(self.engine)['matches'],before)
    def test_unknown_team_rejected(self):
        bad=self.invalid_workbook('G6','Equipo 999')
        with self.assertRaisesRegex(ValueError,'sin correspondencia'):import_excel(bad,self.engine)
    def test_migration_keeps_all_records(self):
        target='sqlite:///'+(Path(self.tmp.name)/'target.db').as_posix();migrate(str(self.engine.url),target);e=engine_for(target)
        self.assertEqual(dataset(self.engine),dataset(e));e.dispose()
        with self.assertRaisesRegex(ValueError,'Destino no vacío'):migrate(str(self.engine.url),target)
    def test_export_no_raw_sensitive_columns(self):
        d=dataset(self.engine);serialized=json.dumps(d);self.assertNotIn('raw_json',serialized)
        self.assertTrue(all('source_row' in m for m in d['matches']))

if __name__=='__main__': unittest.main()
