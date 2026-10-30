"""Anonymous supporter ballots; separate from sporting standings and analytics."""
import hashlib
from threading import Lock
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select, func, delete
from sqlalchemy.orm import Session
from backend.database import TeamVote, Grade
from backend.fans import fans_engine, throttle
from backend.auth import same_origin

router = APIRouter(prefix='/api/voting')
write_lock = Lock()

class Ballot(BaseModel):
    model_config = ConfigDict(extra='forbid')
    visitor_id: UUID
    team_ids: list[str] = Field(min_length=1, max_length=3)

    @field_validator('team_ids')
    @classmethod
    def unique_teams(cls, value):
        if len(set(value)) != len(value):
            raise ValueError('Elige equipos diferentes.')
        return value

def digest(value):
    return hashlib.sha256(str(value).encode()).hexdigest()

def ranking(session, visitor):
    counts = dict(session.execute(select(TeamVote.grade_id, func.count()).group_by(TeamVote.grade_id)).all())
    grades = list(session.scalars(select(Grade).order_by(Grade.display_order)))
    grades.sort(key=lambda g: -counts.get(g.id, 0))
    return {
        'ranking': [{'team_id': g.id, 'votes': counts.get(g.id, 0)} for g in grades],
        'my_votes': list(session.scalars(select(TeamVote.grade_id).where(TeamVote.visitor_id == visitor))),
        'voters': session.scalar(select(func.count(func.distinct(TeamVote.visitor_id)))) or 0,
    }

@router.get('')
def get_ranking(visitor_id: UUID, response: Response, engine=Depends(fans_engine)):
    response.headers['Cache-Control'] = 'no-store'
    with Session(engine) as session:
        return ranking(session, digest(visitor_id))

@router.put('')
def save_ballot(payload: Ballot, request: Request, response: Response, engine=Depends(fans_engine)):
    same_origin(request)
    throttle(request, 'team_vote', 30)
    visitor = digest(payload.visitor_id)
    response.headers['Cache-Control'] = 'no-store'
    with write_lock, Session(engine) as session, session.begin():
        valid = set(session.scalars(select(Grade.id).where(Grade.id.in_(payload.team_ids))))
        if valid != set(payload.team_ids):
            raise HTTPException(422, 'Elige equipos válidos.')
        session.execute(delete(TeamVote).where(TeamVote.visitor_id == visitor))
        session.add_all([TeamVote(visitor_id=visitor, grade_id=team) for team in payload.team_ids])
        session.flush()
        return ranking(session, visitor)
