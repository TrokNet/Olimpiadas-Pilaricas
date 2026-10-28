import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from sqlalchemy import select
from sqlalchemy.orm import Session
from backend.database import ROOT, Grade, Entry, Match, Metadata, MatchResult, initialize, engine_for

def dataset(engine):
    initialize(engine)
    with Session(engine) as s:
        convert=lambda obj:{c.name:getattr(obj,c.name) for c in obj.__table__.columns if c.name!='raw_json'}
        metadata={r.key:r.value for r in s.scalars(select(Metadata))}
        results={r.match_id:r for r in s.scalars(select(MatchResult))}
        matches=[convert(r) for r in s.scalars(select(Match).order_by(Match.date,Match.start,Match.court))]
        official=[m for m in matches if m['kind']=='OFICIAL']
        for reserve in matches:
            if reserve['kind']=='RESERVA':
                occupied=[m['id'] for m in official if m['date']==reserve['date'] and m['court']==reserve['court'] and m['start']<reserve['end'] and reserve['start']<m['end']]
                if occupied:reserve['superseded_by']=occupied
        for match in matches:
            result=results.get(match['id'])
            if result and result.sport==match['sport']:
                payload=json.loads(result.payload);match.update(home_score=payload['home_score'],away_score=payload['away_score'],result={**payload,'updated_at':result.updated_at})
        return {'schemaVersion':1,'timezone':'America/Lima','metadata':{k:v for k,v in metadata.items() if k not in ['scoring_rules','team_art'] and not k.startswith('analytics_')},'rules':json.loads(metadata.get('scoring_rules','{}')),'art':json.loads(metadata.get('team_art','{}')),'grades':[convert(r) for r in s.scalars(select(Grade).order_by(Grade.display_order))],'entries':[convert(r) for r in s.scalars(select(Entry).order_by(Entry.sport,Entry.team_number))],'matches':matches}

if __name__=='__main__':
    data=dataset(engine_for()); output=ROOT/'src/data/tournament.json'; output.parent.mkdir(parents=True,exist_ok=True); output.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf8'); print(f'Exportados {len(data["matches"])} registros desde la BD a {output}')
