"""Reviewed schedule corrections, applied without replacing identities or results."""
import hashlib
import json
import sys
from datetime import date,datetime,timezone
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from sqlalchemy import select
from sqlalchemy.orm import Session
from backend.database import ROOT,Match,Entry,Metadata,engine_for
PATCH=ROOT/'data/schedule_updates_20261026.json'

def apply_in_session(session,path=PATCH):
    raw=Path(path).read_bytes();patch=json.loads(raw.decode('utf-8-sig'))
    entries={e.id:e.grade_id for e in session.scalars(select(Entry))}
    seen=set();changes=0
    for update in patch['matches']:
        if update['id'] in seen:raise ValueError('Partido repetido en actualización.')
        seen.add(update['id']);match=session.get(Match,update['id'])
        if not match or match.kind!='OFICIAL':raise ValueError('Partido oficial inexistente: '+update['id'])
        if (match.sport,match.phase,entries.get(match.home_id),entries.get(match.away_id))!=(update['sport'],update['phase'],update['home_grade_id'],update['away_grade_id']):raise ValueError('La actualización no corresponde a los mismos equipos y disciplina: '+update['id'])
        date.fromisoformat(update['date'])
        for field in ['start','end']:datetime.strptime(update[field],'%H:%M')
        if update['start']>=update['end'] or not update['court'].strip():raise ValueError('Horario o cancha inválidos.')
        if any(getattr(match,key)!=update[key] for key in ['date','start','end','court']):changes+=1
        for key in ['date','start','end','court']:setattr(match,key,update[key])
    session.merge(Metadata(key='schedule_revision',value=patch['revision']))
    session.merge(Metadata(key='schedule_patch_sha256',value=hashlib.sha256(raw).hexdigest()))
    session.merge(Metadata(key='schedule_sources',value=json.dumps(patch['sources'],ensure_ascii=False)))
    return {'reviewed':len(seen),'changed':changes}

def apply_updates(engine,path=PATCH):
    with Session(engine) as s,s.begin():return apply_in_session(s,path)

if __name__=='__main__':
    print(apply_updates(engine_for()))
