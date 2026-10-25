"""Modelo portable. SQLite hoy; DATABASE_URL=postgresql+psycopg://... mañana."""
import os
from pathlib import Path
from sqlalchemy import create_engine, event, Column, String, Integer, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import declarative_base

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_URL = 'sqlite:///' + (ROOT / 'data' / 'olimpiadas.db').as_posix()
Base = declarative_base()

class Grade(Base):
    __tablename__ = 'grades'
    id = Column(String(80), primary_key=True)
    label = Column(String(120), nullable=False, unique=True)
    name = Column(String(160), nullable=False)
    color = Column(String(60), nullable=False)
    display_order = Column(Integer, nullable=False)

class Entry(Base):
    __tablename__ = 'entries'
    id = Column(String(120), primary_key=True)
    sport = Column(String(80), nullable=False, index=True)
    team_number = Column(Integer, nullable=False)
    grade_id = Column(String(80), ForeignKey('grades.id'), nullable=False, index=True)
    source_row = Column(Integer, nullable=False)
    __table_args__ = (UniqueConstraint('sport', 'team_number'), UniqueConstraint('sport', 'grade_id'))

class Match(Base):
    __tablename__ = 'matches'
    id = Column(String(80), primary_key=True)
    date = Column(String(10), nullable=False, index=True)
    start = Column(String(5), nullable=False)
    end = Column(String(5), nullable=False)
    sport = Column(String(80), nullable=False, index=True)
    phase = Column(String(80), nullable=False)
    court = Column(String(100), nullable=False)
    home_id = Column(String(120), ForeignKey('entries.id'), nullable=True)
    away_id = Column(String(120), ForeignKey('entries.id'), nullable=True)
    home_label = Column(String(180), nullable=False)
    away_label = Column(String(180), nullable=False)
    kind = Column(String(40), nullable=False)
    referee = Column(String(160), nullable=False)
    home_score = Column(Integer, nullable=True)
    away_score = Column(Integer, nullable=True)
    source_row = Column(Integer, nullable=False)
    source_sheet = Column(String(80), nullable=False)
    raw_json = Column(Text, nullable=False)

class Metadata(Base):
    __tablename__ = 'metadata'
    key = Column(String(80), primary_key=True)
    value = Column(Text, nullable=False)

class MatchResult(Base):
    """Resultados independientes del Excel, asociados por el UUID estable del partido."""
    __tablename__ = 'match_results'
    match_id = Column(String(80), primary_key=True)
    sport = Column(String(80), nullable=False, index=True)
    payload = Column(Text, nullable=False)
    updated_at = Column(String(40), nullable=False)

class FanMessage(Base):
    __tablename__ = 'fan_messages'
    id = Column(String(40), primary_key=True)
    team_id = Column(String(80), nullable=False, index=True)
    author = Column(String(40), nullable=False)
    message = Column(String(500), nullable=False)
    created_at = Column(String(40), nullable=False, index=True)

class Account(Base):
    __tablename__ = 'accounts'
    username = Column(String(80), primary_key=True)
    password_hash = Column(Text, nullable=False)
    salt = Column(String(64), nullable=False)
    role = Column(String(20), nullable=False)
    grade_id = Column(String(80), nullable=True)

class LoginSession(Base):
    __tablename__ = 'login_sessions'
    token_hash = Column(String(64), primary_key=True)
    username = Column(String(80), ForeignKey('accounts.username'), nullable=False)
    expires_at = Column(Integer, nullable=False)

class ResultAudit(Base):
    __tablename__ = 'result_audit'
    id = Column(String(40), primary_key=True)
    match_id = Column(String(80), nullable=False, index=True)
    username = Column(String(80), nullable=False)
    payload = Column(Text, nullable=False)
    created_at = Column(String(40), nullable=False)

def engine_for(url=None):
    engine = create_engine(url or os.environ.get('DATABASE_URL', DEFAULT_URL))
    if engine.dialect.name == 'sqlite':
        @event.listens_for(engine, 'connect')
        def enable_foreign_keys(connection, _):
            connection.execute('PRAGMA foreign_keys=ON')
    return engine

def initialize(engine):
    Base.metadata.create_all(engine)
