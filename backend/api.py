"""API local de consulta y registro en la BD canónica."""
import json
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session
from scripts.export_data import dataset
from backend.database import engine_for, initialize, Match, Entry, Metadata, MatchResult, ResultAudit
from backend.results import ResultInput, RuleInput, normalize_result
app=FastAPI(title='Olimpiadas Pilaricas 2026',version='1.1.0')
from backend.fans import router as fans_router
app.include_router(fans_router)
from backend.attendance import router as attendance_router
app.include_router(attendance_router)
from backend.auth import session_router, current_user
from backend.analytics import router as analytics_router
app.include_router(session_router, prefix='/api')
app.include_router(analytics_router)
engine=engine_for();initialize(engine)
def current():
    data=dataset(engine);data['capabilities']={'result_write':True};return data
@app.get('/api/tournament')
def tournament(request: Request):
    data=current();data['auth_user']=current_user(request,False);return data
@app.get('/api/matches/{match_id}')
def match(match_id:str):
    item=next((m for m in dataset(engine)['matches'] if m['id']==match_id),None)
    if item is None:raise HTTPException(404,'Partido no encontrado')
    return item

def local_writer(request):
    if request.client and request.client.host not in ['127.0.0.1','::1','testclient']:
        raise HTTPException(403,'El registro está habilitado solo en el servidor local.')
    origin=request.headers.get('origin')
    if origin:
        from urllib.parse import urlparse
        if urlparse(origin).hostname not in ['127.0.0.1','localhost','::1']:
            raise HTTPException(403,'Origen no permitido para registrar resultados.')
@app.put('/api/rules/{sport}')
def save_rules(sport:str,payload:RuleInput,request:Request):
    local_writer(request)
    return write_rules(sport,payload)

def write_rules(sport,payload):
    with Session(engine) as s,s.begin():
        if not s.scalar(select(Entry.id).where(Entry.sport==sport)):raise HTTPException(404,'Disciplina inexistente')
        item=s.get(Metadata,'scoring_rules');rules=json.loads(item.value) if item else {}
        candidate=payload.model_dump()
        if candidate['wo_score_for'] is not None:
            if candidate['wo_score_for']<=candidate['wo_score_against']:raise HTTPException(422,'El marcador de walkover debe dar un ganador.')
            if sport.startswith('voley') and (candidate['wo_score_for']+candidate['wo_score_against']>5 or candidate['wo_set_points']<1):raise HTTPException(422,'Walkover de vóley: máximo 5 sets y tantos positivos.')
        for saved in s.scalars(select(MatchResult).where(MatchResult.sport==sport)):
            match=s.get(Match,saved.match_id)
            if match:
                try:
                    old=json.loads(saved.payload);new=normalize_result(match,old,candidate)
                    if old['walkover']!='none' and any(old.get(k)!=new.get(k) for k in ['home_score','away_score','home_points','away_points']):raise ValueError('Las reglas nuevas cambian un walkover ya registrado; conserva su marcador.')
                except ValueError as e:raise HTTPException(422,str(e)) from e
        rules[sport]=candidate;s.merge(Metadata(key='scoring_rules',value=json.dumps(rules)))
    return current()
@app.put('/api/results/{match_id}')
def save_result(match_id:str,payload:ResultInput,request:Request):
    local_writer(request)
    return write_result(match_id,payload)

def write_result(match_id,payload,actor=None):
    with Session(engine) as s,s.begin():
        item=s.get(Match,match_id)
        if not item:raise HTTPException(404,'Partido inexistente')
        rules=s.get(Metadata,'scoring_rules');rule=json.loads(rules.value).get(item.sport) if rules else None
        if not rule:raise HTTPException(422,'Guarda las reglas de puntuación de esta disciplina antes del resultado.')
        try:result=normalize_result(item,payload.model_dump(),rule)
        except ValueError as e:raise HTTPException(422,str(e)) from e
        if actor:
            from uuid import uuid4
            s.add(ResultAudit(id=str(uuid4()),match_id=item.id,username=actor,payload=json.dumps(result),created_at=datetime.now(timezone.utc).isoformat()))
        s.merge(MatchResult(match_id=item.id,sport=item.sport,payload=json.dumps(result),updated_at=datetime.now(timezone.utc).isoformat()))
    return current()
