"""Shared fan wall. Deletion credentials are server-only, never exported."""
import hashlib
import hmac
import json
import os
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, func, or_, and_
from sqlalchemy.orm import Session
from backend.database import ROOT, FanMessage, Grade, engine_for, initialize

router = APIRouter(prefix='/api/fans', tags=['Fans'])
_engine = engine_for()
initialize(_engine)
_attempts = defaultdict(deque)
_lock = Lock()

def fans_engine():
    return _engine

def throttle(request, action, limit):
    address = request.headers.get('cf-connecting-ip') or (request.client.host if request.client else 'unknown')
    now = time.monotonic()
    with _lock:
        # Keep only recent anonymous counters; no IP addresses are stored in SQLite.
        if len(_attempts) > 4096:
            for key in list(_attempts):
                if not _attempts[key] or _attempts[key][-1] < now-60: del _attempts[key]
        hits = _attempts[(action,address)]
        while hits and hits[0] < now-60: hits.popleft()
        if len(hits) >= limit: raise HTTPException(429,'Demasiados intentos. Espera un minuto.',headers={'Retry-After':'60'})
        hits.append(now)

class NewMessage(BaseModel):
    team_id: str = Field(min_length=1,max_length=80)
    author: str = Field(default='',max_length=40)
    message: str = Field(min_length=1,max_length=500)

    @field_validator('message')
    @classmethod
    def clean_message(cls,value):
        value=value.strip()
        if not value: raise ValueError('Escribe un mensaje.')
        return value

class DeleteMessage(BaseModel):
    password: str = Field(min_length=1,max_length=128,repr=False)

def verify_password(password):
    config_path=Path(os.environ.get('FANS_ADMIN_CONFIG',str(ROOT/'.local/fans_admin.json')))
    try:
        config=json.loads(config_path.read_text(encoding='utf-8'))
        candidate=hashlib.scrypt(password.encode(),salt=bytes.fromhex(config['salt']),n=16384,r=8,p=1).hex()
        return hmac.compare_digest(candidate,config['hash'])
    except (OSError,ValueError,KeyError):
        raise HTTPException(503,'El borrado todavía no está configurado en el servidor.')

def serialize(item):
    return {key:getattr(item,key) for key in ['id','team_id','author','message','created_at']}

@router.get('')
def list_messages(team_id: str|None=None,cursor: str|None=None,limit:int=Query(default=30,ge=1,le=50),engine=Depends(fans_engine)):
    with Session(engine) as session:
        query=select(FanMessage)
        count=select(func.count()).select_from(FanMessage)
        if team_id:
            query=query.where(FanMessage.team_id==team_id)
            count=count.where(FanMessage.team_id==team_id)
        total=session.scalar(count)
        if cursor:
            anchor=session.get(FanMessage,cursor)
            if not anchor: raise HTTPException(400,'La página de mensajes ya no está disponible. Actualiza el historial.')
            query=query.where(or_(FanMessage.created_at<anchor.created_at,and_(FanMessage.created_at==anchor.created_at,FanMessage.id<anchor.id)))
        rows=list(session.scalars(query.order_by(FanMessage.created_at.desc(),FanMessage.id.desc()).limit(limit+1)))
        return {'messages':[serialize(m) for m in rows[:limit]],'total':total,'next_cursor':rows[limit-1].id if len(rows)>limit else None}

@router.post('',status_code=201)
def post_message(payload:NewMessage,request:Request,engine=Depends(fans_engine)):
    throttle(request,'post',20)
    with Session(engine) as session,session.begin():
        if not session.get(Grade,payload.team_id): raise HTTPException(422,'Elige un equipo válido.')
        item=FanMessage(id=str(uuid4()),team_id=payload.team_id,author=payload.author.strip() or 'Hincha pilarico',message=payload.message,created_at=datetime.now(timezone.utc).isoformat())
        session.add(item);session.flush()
        return serialize(item)

@router.delete('/{message_id}')
def delete_message(message_id:str,payload:DeleteMessage,request:Request,engine=Depends(fans_engine)):
    throttle(request,'delete',8)
    if not verify_password(payload.password): raise HTTPException(403,'Clave incorrecta.')
    with Session(engine) as session,session.begin():
        item=session.get(FanMessage,message_id)
        if not item: raise HTTPException(404,'Este mensaje ya fue eliminado.')
        session.delete(item)
    return {'deleted':True}
