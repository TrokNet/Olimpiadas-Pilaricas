"""Private audience statistics; no IP, user-agent, URL or credential storage."""
import hashlib
import time
from datetime import date, datetime, timedelta, timezone
from threading import Lock
from uuid import UUID, uuid4
from fastapi import APIRouter, HTTPException, Request, Response, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from backend.database import AnalyticsVisitor, AnalyticsVisit, AnalyticsVisitorDay, AnalyticsTeamSelection, HistoricalAccess, Grade, Metadata
from backend.fans import fans_engine, throttle
from backend.auth import current_user, same_origin

router = APIRouter(prefix='/api', tags=['Estadísticas privadas'])
LIMA = timezone(timedelta(hours=-5))
_write_lock = Lock()

def lima_day(timestamp):
    return datetime.fromtimestamp(timestamp, LIMA).date().isoformat()

class Heartbeat(BaseModel):
    model_config = ConfigDict(extra='forbid')
    visitor_id: str = Field(min_length=36, max_length=36)

    @field_validator('visitor_id')
    @classmethod
    def valid_uuid(cls, value):
        return str(UUID(value))

class TeamSelection(BaseModel):
    model_config = ConfigDict(extra='forbid')
    visitor_id: str = Field(min_length=36, max_length=36)
    grade_id: str = Field(min_length=1, max_length=80)

    @field_validator('visitor_id')
    @classmethod
    def valid_visitor_id(cls, value):
        return str(UUID(value))

def record_activity(engine, visitor_id, now=None):
    now = int(time.time()) if now is None else now
    identifier = hashlib.sha256(visitor_id.encode()).hexdigest()
    # Serialize the check and creation across requests/tabs on this single-process host.
    with _write_lock, Session(engine) as s, s.begin():
        visitor = s.get(AnalyticsVisitor, identifier)
        if not s.get(Metadata, 'analytics_started_at'):
            s.add(Metadata(key='analytics_started_at', value=str(now)))
        if visitor is None or now - visitor.last_seen >= 1800:
            s.add(AnalyticsVisit(id=str(uuid4()), visitor_id=identifier, day=lima_day(now), started_at=now))
        if visitor is None:
            s.add(AnalyticsVisitor(id=identifier, first_seen=now, last_seen=now))
        else:
            visitor.last_seen = now
        if not s.get(AnalyticsVisitorDay, (identifier, lima_day(now))):
            s.add(AnalyticsVisitorDay(visitor_id=identifier, day=lima_day(now)))

def record_team_selection(engine, visitor_id, grade_id, now=None):
    now = int(time.time()) if now is None else now
    identifier = hashlib.sha256(visitor_id.encode()).hexdigest()
    with _write_lock, Session(engine) as s, s.begin():
        if not s.get(Grade, grade_id):
            raise ValueError('El equipo seleccionado no existe.')
        selection = s.get(AnalyticsTeamSelection, identifier)
        if selection is None:
            s.add(AnalyticsTeamSelection(visitor_id=identifier, grade_id=grade_id, selected_at=now))
            if not s.get(Metadata, 'analytics_team_selection_started_at'):
                s.add(Metadata(key='analytics_team_selection_started_at', value=str(now)))
        elif selection.grade_id != grade_id:
            selection.grade_id = grade_id
            selection.selected_at = now

@router.post('/analytics/heartbeat', status_code=204)
def heartbeat(payload: Heartbeat, request: Request):
    same_origin(request)
    throttle(request, 'analytics', 2400)
    record_activity(fans_engine(), payload.visitor_id)
    return Response(status_code=204, headers={'Cache-Control': 'no-store'})

@router.post('/analytics/team-selection', status_code=204)
def save_team_selection(payload: TeamSelection, request: Request):
    same_origin(request)
    throttle(request, 'team_selection', 60)
    try:
        record_team_selection(fans_engine(), payload.visitor_id, payload.grade_id)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    return Response(status_code=204, headers={'Cache-Control': 'no-store'})

def statistics(engine, start, end, now=None):
    now = int(time.time()) if now is None else now
    with Session(engine) as s:
        def count(model, *conditions):
            return s.scalar(select(func.count()).select_from(model).where(*conditions)) or 0
        def grouped(model):
            return dict(s.execute(select(model.day, func.count()).where(model.day >= start, model.day <= end).group_by(model.day)).all())
        uniques, visits, recovered = grouped(AnalyticsVisitorDay), grouped(AnalyticsVisit), grouped(HistoricalAccess)
        history = []
        current = date.fromisoformat(start)
        while current.isoformat() <= end:
            day = current.isoformat()
            history.append({'date': day, 'visitors': uniques.get(day, 0), 'visits': visits.get(day, 0), 'recovered_accesses': recovered.get(day, 0)})
            current += timedelta(days=1)
        started = s.get(Metadata, 'analytics_started_at')
        coverage = s.get(Metadata, 'analytics_journal_coverage')
        team_started = s.get(Metadata, 'analytics_team_selection_started_at')
        selection_counts = dict(s.execute(select(AnalyticsTeamSelection.grade_id, func.count()).group_by(AnalyticsTeamSelection.grade_id)).all())
        team_selections = [
            {'grade_id': grade.id, 'label': grade.label, 'name': grade.name, 'color': grade.color, 'count': selection_counts.get(grade.id, 0), 'display_order': grade.display_order}
            for grade in s.scalars(select(Grade).order_by(Grade.display_order))
        ]
        team_selections.sort(key=lambda item: (-item['count'], item['display_order']))
        for item in team_selections:
            item.pop('display_order')
        return {
            'timezone': 'America/Lima', 'updated_at': now,
            'tracking_started_at': int(started.value) if started else None,
            'historical_coverage_from': coverage.value if coverage else None,
            'online': count(AnalyticsVisitor, AnalyticsVisitor.last_seen > now-120),
            'total_visitors': count(AnalyticsVisitor), 'total_visits': count(AnalyticsVisit),
            'recovered_accesses': count(HistoricalAccess),
            'team_selection_started_at': int(team_started.value) if team_started else None,
            'selected_team_visitors': sum(item['count'] for item in team_selections),
            'team_selections': team_selections,
            'today_visitors': count(AnalyticsVisitorDay, AnalyticsVisitorDay.day == lima_day(now)),
            'today_visits': count(AnalyticsVisit, AnalyticsVisit.day == lima_day(now)),
            'period_visitors': s.scalar(select(func.count(func.distinct(AnalyticsVisitorDay.visitor_id))).where(AnalyticsVisitorDay.day >= start, AnalyticsVisitorDay.day <= end)) or 0,
            'history': history,
        }

@router.get('/admin/analytics')
def admin_statistics(request: Request, response: Response, start: date | None = Query(None), end: date | None = Query(None), all_history: bool = False):
    user = current_user(request)
    if user['role'] != 'admin':
        raise HTTPException(403, 'Solo el administrador puede ver las estadísticas.')
    today = date.fromisoformat(lima_day(int(time.time())))
    end = end or today
    start = start or end - timedelta(days=29)
    if all_history:
        with Session(fans_engine()) as s:
            coverage = s.get(Metadata, 'analytics_journal_coverage')
            first = s.scalar(select(func.min(AnalyticsVisitor.first_seen)))
            earliest = min([today.isoformat()] + ([coverage.value] if coverage else []) + ([lima_day(first)] if first is not None else []))
            start = date.fromisoformat(earliest)
    if start > end or (end-start).days > 3660 or end > today:
        raise HTTPException(422, 'Selecciona un intervalo válido de hasta 10 años, sin fechas futuras.')
    response.headers['Cache-Control'] = 'no-store'
    return statistics(fans_engine(), start.isoformat(), end.isoformat())
