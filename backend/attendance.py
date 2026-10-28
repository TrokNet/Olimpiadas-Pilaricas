"""Anonymous, per-match attendance confirmations."""
import hashlib
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.auth import same_origin
from backend.database import Match, MatchAttendance
from backend.fans import fans_engine, throttle

router = APIRouter(prefix='/api/attendance', tags=['Asistencia'])


class AttendanceInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    visitor_id: str = Field(min_length=36, max_length=36)

    @field_validator('visitor_id')
    @classmethod
    def valid_uuid(cls, value):
        return str(UUID(value))


def anonymous_hash(visitor_id):
    return hashlib.sha256(visitor_id.encode()).hexdigest()


def get_match(session, match_id):
    match = session.get(Match, match_id)
    if not match or match.kind != 'OFICIAL':
        raise HTTPException(404, 'Partido no disponible para confirmar asistencia.')
    return match


def summary(session, match_id, visitor_hash=None):
    count = session.scalar(select(func.count()).select_from(MatchAttendance).where(MatchAttendance.match_id == match_id)) or 0
    attending = bool(visitor_hash and session.scalar(select(MatchAttendance.id).where(MatchAttendance.match_id == match_id, MatchAttendance.visitor_hash == visitor_hash)))
    return {'count': count, 'attending': attending}


@router.get('/{match_id}')
def get_attendance(match_id: str, visitor_id: str | None = None, engine=Depends(fans_engine)):
    visitor_hash = None
    if visitor_id:
        try:
            visitor_hash = anonymous_hash(str(UUID(visitor_id)))
        except ValueError:
            raise HTTPException(422, 'Identificador inválido.')
    with Session(engine) as session:
        get_match(session, match_id)
        return summary(session, match_id, visitor_hash)


@router.post('/{match_id}')
def attend(match_id: str, payload: AttendanceInput, request: Request, engine=Depends(fans_engine)):
    same_origin(request)
    throttle(request, 'attendance', 30)
    visitor_hash = anonymous_hash(payload.visitor_id)
    with Session(engine) as session, session.begin():
        get_match(session, match_id)
        row_id = hashlib.sha256(f'{match_id}:{visitor_hash}'.encode()).hexdigest()
        if not session.get(MatchAttendance, row_id):
            session.add(MatchAttendance(id=row_id, match_id=match_id, visitor_hash=visitor_hash, created_at=datetime.now(timezone.utc).isoformat()))
        session.flush()
        return summary(session, match_id, visitor_hash)


@router.delete('/{match_id}')
def cancel_attendance(match_id: str, payload: AttendanceInput, request: Request, engine=Depends(fans_engine)):
    same_origin(request)
    throttle(request, 'attendance', 30)
    visitor_hash = anonymous_hash(payload.visitor_id)
    with Session(engine) as session, session.begin():
        get_match(session, match_id)
        row_id = hashlib.sha256(f'{match_id}:{visitor_hash}'.encode()).hexdigest()
        row = session.get(MatchAttendance, row_id)
        if row:
            session.delete(row)
        session.flush()
        return summary(session, match_id, visitor_hash)
