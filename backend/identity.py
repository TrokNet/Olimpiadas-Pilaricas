"""Private review inbox; approval never changes public team artwork."""
import base64
import json
import re
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from backend.database import TeamIdentitySubmission, Grade
from backend.fans import fans_engine, throttle
from backend.auth import current_user, same_origin

router = APIRouter(prefix='/api/team-identity')

class Submission(BaseModel):
    model_config = ConfigDict(extra='forbid')
    team_id: str = Field(min_length=1, max_length=80)
    logo: str | None = Field(default=None, max_length=4_200_000)
    mascot: str | None = Field(default=None, max_length=4_200_000)

class Review(BaseModel):
    status: str = Field(pattern='^(approved|rejected)$')

def admin(request):
    user = current_user(request)
    if user['role'] != 'admin':
        raise HTTPException(403, 'Solo administración puede revisar los envíos.')
    return user

def validate_image(value):
    from backend.community import image_dimensions
    match = re.fullmatch(r'data:(image/png|image/jpeg);base64,([A-Za-z0-9+/]+={0,2})', value)
    if not match:
        raise HTTPException(415, 'Elige una imagen PNG o JPG.')
    mime, encoded = match.groups()
    try:
        content = base64.b64decode(encoded, validate=True)
    except ValueError:
        raise HTTPException(422, 'Imagen inválida.')
    if not content or len(content) > 3 * 1024 * 1024:
        raise HTTPException(413, 'Cada imagen debe pesar hasta 3 MB.')
    size = image_dimensions(content, mime)
    if not size or min(size) < 1 or max(size) > 8000 or size[0] * size[1] > 32_000_000:
        raise HTTPException(422, 'Imagen inválida o demasiado grande.')
    return {'mime': mime, 'content': encoded}

@router.post('', status_code=201)
def submit(payload: Submission, request: Request, engine=Depends(fans_engine)):
    same_origin(request)
    throttle(request, 'identity_upload', 4)
    assets = {kind: validate_image(value) for kind, value in [('logo', payload.logo), ('mascot', payload.mascot)] if value}
    if not assets:
        raise HTTPException(422, 'Adjunta al menos un logo o una mascota.')
    identifier = str(uuid4())
    with Session(engine) as session, session.begin():
        if not session.get(Grade, payload.team_id):
            raise HTTPException(422, 'Equipo inválido.')
        session.add(TeamIdentitySubmission(id=identifier, team_id=payload.team_id, assets=json.dumps(assets), status='pending', created_at=datetime.now(timezone.utc).isoformat()))
    return {'id': identifier, 'message': 'Recibido. Tu envío está pendiente de aprobación del administrador.'}

@router.get('/review')
def inbox(request: Request, engine=Depends(fans_engine)):
    admin(request)
    with Session(engine) as session:
        rows = session.scalars(select(TeamIdentitySubmission).order_by(TeamIdentitySubmission.created_at.desc()).limit(100))
        return {'submissions': [{'id': r.id, 'team_id': r.team_id, 'status': r.status, 'created_at': r.created_at, 'reviewed_by': r.reviewed_by, 'assets': {kind: f'/api/team-identity/{r.id}/image/{kind}' for kind in json.loads(r.assets)}} for r in rows]}

@router.get('/{identifier}/image/{kind}')
def image(identifier: str, kind: str, request: Request, engine=Depends(fans_engine)):
    admin(request)
    with Session(engine) as session:
        row = session.get(TeamIdentitySubmission, identifier)
        asset = json.loads(row.assets).get(kind) if row else None
        if not asset:
            raise HTTPException(404, 'Archivo no encontrado.')
        return Response(base64.b64decode(asset['content']), media_type=asset['mime'], headers={'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'})

@router.patch('/{identifier}/review')
def review(identifier: str, payload: Review, request: Request, engine=Depends(fans_engine)):
    user = admin(request)
    same_origin(request)
    with Session(engine) as session, session.begin():
        row = session.get(TeamIdentitySubmission, identifier)
        if not row:
            raise HTTPException(404, 'Envío no encontrado.')
        row.status = payload.status
        row.reviewed_by = user['username']
        row.reviewed_at = datetime.now(timezone.utc).isoformat()
    return {'status': payload.status}
