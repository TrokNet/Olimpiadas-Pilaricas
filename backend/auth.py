"""Session authentication and server-enforced grade-scoped result permissions."""
import hashlib
import hmac
import secrets
import time
from urllib.parse import urlparse
from fastapi import APIRouter, HTTPException, Request, Response, Depends
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy import select, delete
from sqlalchemy.orm import Session
from backend.database import Account, LoginSession, Entry, Match
from backend.fans import fans_engine, throttle
from backend.results import ResultInput, RuleInput
from scripts.export_data import dataset

router=APIRouter(prefix='/api')
COOKIE='olimpiadas_session'

def password_hash(password,salt):
    return hashlib.scrypt(password.encode(),salt=bytes.fromhex(salt),n=16384,r=8,p=1).hex()

def identity(account):
    return {'username':account.username,'role':account.role,'grade_id':account.grade_id}

def current_user(request,required=True):
    token=request.cookies.get(COOKIE,'')
    with Session(fans_engine()) as s:
        session=s.get(LoginSession,hashlib.sha256(token.encode()).hexdigest()) if token else None
        account=s.get(Account,session.username) if session and session.expires_at>int(time.time()) else None
        if account:return identity(account)
    if required:raise HTTPException(401,'Inicia sesión para registrar resultados.')
    return None

def same_origin(request):
    origin=request.headers.get('origin')
    if origin and urlparse(origin).netloc != request.headers.get('host'):
        raise HTTPException(403,'Origen no permitido.')

def tournament_for(request):
    user=current_user(request,False)
    data=dataset(fans_engine())
    data['capabilities']={'result_write':bool(user),'auth_required':True}
    data['auth_user']=user
    return data

class LoginInput(BaseModel):
    model_config=ConfigDict(extra='forbid')
    username:str=Field(min_length=1,max_length=80)
    password:str=Field(min_length=1,max_length=128,repr=False)

@router.post('/auth/login')
def login(payload:LoginInput,request:Request,response:Response):
    same_origin(request);throttle(request,'login',10)
    with Session(fans_engine()) as s,s.begin():
        account=s.get(Account,payload.username.strip().lower())
        salt=account.salt if account else '00'*16
        valid=hmac.compare_digest(password_hash(payload.password,salt),account.password_hash if account else '0'*128)
        if not account or not valid:raise HTTPException(401,'Usuario o contraseña incorrectos.')
        s.execute(delete(LoginSession).where(LoginSession.expires_at<=int(time.time())))
        old=request.cookies.get(COOKIE)
        if old:s.execute(delete(LoginSession).where(LoginSession.token_hash==hashlib.sha256(old.encode()).hexdigest()))
        token=secrets.token_urlsafe(32)
        s.add(LoginSession(token_hash=hashlib.sha256(token.encode()).hexdigest(),username=account.username,expires_at=int(time.time())+43200))
        user=identity(account)
    response.headers['Cache-Control']='no-store'
    response.set_cookie(COOKIE,token,max_age=43200,httponly=True,secure=request.url.hostname not in ['localhost','127.0.0.1','::1','testserver'],samesite='strict',path='/')
    data=dataset(fans_engine());data['auth_user']=user;data['capabilities']={'result_write':True,'auth_required':True}
    return data

@router.post('/auth/logout')
def logout(request:Request,response:Response):
    same_origin(request)
    with Session(fans_engine()) as s,s.begin():
        token=request.cookies.get(COOKIE,'')
        s.execute(delete(LoginSession).where(LoginSession.token_hash==hashlib.sha256(token.encode()).hexdigest()))
    response.delete_cookie(COOKIE,path='/');response.headers['Cache-Control']='no-store'
    data=dataset(fans_engine());data['auth_user']=None;data['capabilities']={'result_write':False,'auth_required':True}
    return data

def authenticated(request:Request):
    return current_user(request)

@router.put('/results/{match_id}',dependencies=[Depends(authenticated)])
def save_result(match_id:str,payload:ResultInput,request:Request):
    same_origin(request);user=current_user(request)
    with Session(fans_engine()) as s:
        match=s.get(Match,match_id)
        if not match:raise HTTPException(404,'Partido inexistente.')
        if user['role']!='admin':
            participants=set(s.scalars(select(Entry.grade_id).where(Entry.id.in_([match.home_id,match.away_id]))))
            if user['grade_id'] not in participants:raise HTTPException(403,'Solo puedes registrar partidos donde participa tu equipo.')
    from backend.api import write_result
    write_result(match_id,payload,actor=user['username'])
    return tournament_for(request)

@router.put('/rules/{sport}',dependencies=[Depends(authenticated)])
def save_rules(sport:str,payload:RuleInput,request:Request):
    same_origin(request);user=current_user(request)
    if user['role']!='admin':raise HTTPException(403,'Solo el administrador puede configurar el reglamento.')
    from backend.api import write_rules
    write_rules(sport,payload)
    return tournament_for(request)
