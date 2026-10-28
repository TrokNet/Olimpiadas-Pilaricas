"""Community predictions and moderated photo gallery."""
import base64
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.auth import current_user, same_origin
from backend.database import GalleryPhoto, Grade, Match, MatchPrediction
from backend.fans import fans_engine, throttle

router = APIRouter(tags=['Comunidad'])
LIMA = ZoneInfo('America/Lima')
GALLERY_DIR = Path(__file__).resolve().parents[1] / '.local' / 'gallery'
MAX_IMAGE_BYTES = 3 * 1024 * 1024


class VisitorInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    visitor_id: str = Field(min_length=36, max_length=36)
    choice: str = Field(pattern='^(home|away)$')

    @field_validator('visitor_id')
    @classmethod
    def validate_id(cls, value):
        return str(UUID(value))


class PhotoInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    team_id: str = Field(min_length=1, max_length=80)
    caption: str = Field(default='', max_length=120)
    image: str = Field(min_length=30, max_length=4_200_000)


class ReviewInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    status: str = Field(pattern='^(approved|rejected)$')


def visitor_hash(visitor_id):
    try:
        identifier = str(UUID(visitor_id))
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(422, 'Identificador de visitante inválido.')
    return hashlib.sha256(identifier.encode()).hexdigest()


def get_match(session, match_id):
    match = session.get(Match, match_id)
    if not match or match.kind != 'OFICIAL' or not match.home_id or not match.away_id:
        raise HTTPException(404, 'Este partido no admite pronósticos.')
    return match


def is_open(match):
    kickoff = datetime.strptime(f'{match.date} {match.start}', '%Y-%m-%d %H:%M').replace(tzinfo=LIMA)
    return kickoff > datetime.now(LIMA)


def prediction_summary(session, match_id, digest, match):
    counts = {row[0]: row[1] for row in session.execute(
        select(MatchPrediction.choice, func.count()).where(MatchPrediction.match_id == match_id).group_by(MatchPrediction.choice)
    )}
    own = session.scalar(select(MatchPrediction.choice).where(MatchPrediction.match_id == match_id, MatchPrediction.visitor_hash == digest))
    return {'home': counts.get('home', 0), 'away': counts.get('away', 0), 'my_vote': own, 'open': is_open(match)}


@router.get('/api/predictions/{match_id}')
def get_prediction(match_id: str, visitor_id: str, engine=Depends(fans_engine)):
    digest = visitor_hash(visitor_id)
    with Session(engine) as session:
        match = get_match(session, match_id)
        return prediction_summary(session, match_id, digest, match)


@router.post('/api/predictions/{match_id}')
def vote_prediction(match_id: str, payload: VisitorInput, request: Request, engine=Depends(fans_engine)):
    same_origin(request)
    throttle(request, 'prediction', 30)
    digest = visitor_hash(payload.visitor_id)
    with Session(engine) as session, session.begin():
        match = get_match(session, match_id)
        if not is_open(match):
            raise HTTPException(409, 'Los pronósticos se cerraron al iniciar el partido.')
        row_id = hashlib.sha256(f'{match_id}:{digest}'.encode()).hexdigest()
        row = session.get(MatchPrediction, row_id)
        if row:
            row.choice = payload.choice
            row.created_at = datetime.now(timezone.utc).isoformat()
        else:
            session.add(MatchPrediction(id=row_id, match_id=match_id, visitor_hash=digest, choice=payload.choice, created_at=datetime.now(timezone.utc).isoformat()))
        session.flush()
        return prediction_summary(session, match_id, digest, match)


def image_dimensions(content, content_type):
    if content_type == 'image/png':
        if len(content) < 24 or content[:8] != b'\x89PNG\r\n\x1a\n' or content[12:16] != b'IHDR':
            return None
        return int.from_bytes(content[16:20], 'big'), int.from_bytes(content[20:24], 'big')
    if content_type != 'image/jpeg' or not content.startswith(b'\xff\xd8\xff'):
        return None
    sof = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}
    index = 2
    while index + 9 < len(content):
        if content[index] != 0xFF:
            index += 1
            continue
        marker = content[index + 1]
        index += 2
        if marker in {0xD8, 0xD9, 0x01, *range(0xD0, 0xD8)}:
            continue
        if index + 2 > len(content):
            break
        length = int.from_bytes(content[index:index + 2], 'big')
        if length < 2 or index + length > len(content):
            break
        if marker in sof and length >= 7:
            height = int.from_bytes(content[index + 3:index + 5], 'big')
            width = int.from_bytes(content[index + 5:index + 7], 'big')
            return width, height
        index += length
    return None


def require_admin(request):
    user = current_user(request)
    if user['role'] != 'admin':
        raise HTTPException(403, 'Solo administración puede revisar las fotos.')
    return user


def serialize_photo(item):
    return {'id': item.id, 'team_id': item.team_id, 'caption': item.caption, 'content_type': item.content_type, 'status': item.status, 'created_at': item.created_at, 'image_url': f'/api/gallery/{item.id}/image'}


@router.get('/api/gallery')
def list_photos(team_id: str | None = None, engine=Depends(fans_engine)):
    with Session(engine) as session:
        query = select(GalleryPhoto).where(GalleryPhoto.status == 'approved')
        if team_id:
            query = query.where(GalleryPhoto.team_id == team_id)
        photos = session.scalars(query.order_by(GalleryPhoto.created_at.desc()).limit(60))
        return {'photos': [serialize_photo(photo) for photo in photos]}


@router.post('/api/gallery', status_code=201)
def submit_photo(payload: PhotoInput, request: Request, engine=Depends(fans_engine)):
    same_origin(request)
    throttle(request, 'gallery_upload', 4)
    match = re.fullmatch(r'data:(image/png|image/jpeg);base64,([A-Za-z0-9+/]+={0,2})', payload.image)
    if not match:
        raise HTTPException(415, 'Sube una imagen JPG o PNG.')
    content_type, encoded = match.groups()
    try:
        image_bytes = base64.b64decode(encoded, validate=True)
    except ValueError:
        raise HTTPException(422, 'El archivo de imagen no es válido.')
    if not image_bytes or len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(413, 'La imagen debe pesar hasta 3 MB.')
    dimensions = image_dimensions(image_bytes, content_type)
    if not dimensions or min(dimensions) < 1 or max(dimensions) > 8000 or dimensions[0] * dimensions[1] > 32_000_000:
        raise HTTPException(422, 'La imagen no es válida o supera 32 megapíxeles.')
    photo_id = str(uuid4())
    suffix = '.png' if content_type == 'image/png' else '.jpg'
    GALLERY_DIR.mkdir(parents=True, exist_ok=True)
    path = GALLERY_DIR / f'{photo_id}{suffix}'
    path.write_bytes(image_bytes)
    try:
        with Session(engine) as session, session.begin():
            if not session.get(Grade, payload.team_id):
                raise HTTPException(422, 'Elige un equipo válido.')
            photo = GalleryPhoto(id=photo_id, team_id=payload.team_id, caption=payload.caption.strip(), content_type=content_type, status='pending', created_at=datetime.now(timezone.utc).isoformat())
            session.add(photo)
    except Exception:
        path.unlink(missing_ok=True)
        raise
    return {'submitted': True, 'message': 'Foto recibida. Se mostrará cuando administración la apruebe.'}


@router.get('/api/gallery/review')
def pending_photos(request: Request, engine=Depends(fans_engine)):
    require_admin(request)
    with Session(engine) as session:
        photos = session.scalars(select(GalleryPhoto).where(GalleryPhoto.status == 'pending').order_by(GalleryPhoto.created_at.asc()).limit(100))
        return {'photos': [serialize_photo(photo) for photo in photos]}


@router.patch('/api/gallery/{photo_id}/review')
def review_photo(photo_id: str, payload: ReviewInput, request: Request, engine=Depends(fans_engine)):
    user = require_admin(request)
    same_origin(request)
    path = None
    with Session(engine) as session, session.begin():
        photo = session.get(GalleryPhoto, photo_id)
        if not photo:
            raise HTTPException(404, 'Foto no encontrada.')
        photo.status = payload.status
        photo.reviewed_at = datetime.now(timezone.utc).isoformat()
        photo.reviewed_by = user['username']
        if payload.status == 'rejected':
            path = GALLERY_DIR / f'{photo.id}.{"png" if photo.content_type == "image/png" else "jpg"}'
        session.flush()
        result = serialize_photo(photo)
    if path:
        path.unlink(missing_ok=True)
    return result


@router.get('/api/gallery/{photo_id}/image')
def photo_image(photo_id: str, request: Request, engine=Depends(fans_engine)):
    with Session(engine) as session:
        photo = session.get(GalleryPhoto, photo_id)
        if not photo or photo.status == 'rejected':
            raise HTTPException(404, 'Foto no disponible.')
        if photo.status != 'approved':
            require_admin(request)
        media_type = photo.content_type
        path = GALLERY_DIR / f'{photo.id}.{"png" if media_type == "image/png" else "jpg"}'
        if not path.is_file():
            raise HTTPException(404, 'La imagen ya no está disponible.')
    return FileResponse(path, media_type=media_type, headers={'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=3600'})
