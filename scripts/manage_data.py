"""Administración local de la BD canónica. Exportar después para actualizar la web."""
import argparse
import json
import sys
from pathlib import Path
from datetime import date, datetime
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from sqlalchemy import select
from sqlalchemy.orm import Session
from backend.database import Grade,Entry,Match,Metadata,engine_for

def validate(engine):
    with Session(engine) as s:
        grades={g.id:g for g in s.scalars(select(Grade))}; entries={e.id:e for e in s.scalars(select(Entry))}; matches=list(s.scalars(select(Match)))
        if not entries or not matches: raise ValueError('Base de datos vacía')
        for e in entries.values():
            if e.grade_id not in grades: raise ValueError(f'Grado desconocido: {e.id}')
        for m in matches:
            date.fromisoformat(m.date)
            for value in [m.start,m.end]: datetime.strptime(value,'%H:%M')
            if m.start>=m.end: raise ValueError(f'Horario inválido: {m.id}')
            for eid in [m.home_id,m.away_id]:
                if eid and (eid not in entries or entries[eid].sport!=m.sport): raise ValueError(f'Correspondencia inválida: {m.id}')
            if m.home_id and m.home_id==m.away_id: raise ValueError(f'Equipo repetido: {m.id}')
            if (m.home_score is None)!=(m.away_score is None): raise ValueError(f'Resultado incompleto: {m.id}')
            if any(n is not None and n<0 for n in [m.home_score,m.away_score]): raise ValueError(f'Resultado negativo: {m.id}')
        return {'grades':len(grades),'entries':len(entries),'matches':len(matches)}

def main():
    p=argparse.ArgumentParser(); sub=p.add_subparsers(dest='command',required=True)
    sub.add_parser('validate')
    rules=sub.add_parser('rules');rules.add_argument('json_file')
    participants=sub.add_parser('participants');participants.add_argument('match_id');participants.add_argument('--home',required=True);participants.add_argument('--away',required=True)
    r=sub.add_parser('result');r.add_argument('match_id');r.add_argument('home',type=int);r.add_argument('away',type=int)
    n=sub.add_parser('team-name');n.add_argument('grade_id');n.add_argument('name')
    f=sub.add_parser('schedule');f.add_argument('match_id');f.add_argument('--date',required=True);f.add_argument('--start',required=True);f.add_argument('--end',required=True);f.add_argument('--court',required=True)
    args=p.parse_args(); engine=engine_for()
    if args.command=='validate': print(validate(engine));return
    with Session(engine) as s, s.begin():
        if args.command=='rules':
            rules=json.loads(Path(args.json_file).read_text(encoding='utf-8-sig'))
            sports=set(s.scalars(select(Entry.sport)))
            for sport,rule in rules.items():
                if sport not in sports: raise ValueError(f'Disciplina desconocida: {sport}')
                if any(type(rule.get(k)) not in [int,float] or rule[k]<0 for k in ['win','draw','loss']): raise ValueError('Faltan valores de puntuación válidos')
                if type(rule.get('allow_draw')) is not bool or not rule.get('tiebreakers') or any(k not in ['points','wins','difference','for'] for k in rule['tiebreakers']): raise ValueError('Indicar allow_draw y criterios de desempate oficiales')
            s.merge(Metadata(key='scoring_rules',value=json.dumps(rules)))
        elif args.command=='team-name':
            item=s.get(Grade,args.grade_id)
            if not item or not args.name.strip(): raise ValueError('Grado inexistente o nombre vacío')
            item.name=args.name.strip()
        else:
            item=s.get(Match,args.match_id)
            if not item: raise ValueError('Partido inexistente')
            if args.command=='participants':
                home=s.get(Entry,args.home);away=s.get(Entry,args.away)
                if not home or not away or home.sport!=item.sport or away.sport!=item.sport or home.id==away.id: raise ValueError('Participantes inexistentes, repetidos o de otra disciplina')
                item.home_id=home.id;item.away_id=away.id;item.home_label=f'Equipo {home.team_number}';item.away_label=f'Equipo {away.team_number}'
            elif args.command=='result':
                if args.home<0 or args.away<0: raise ValueError('Marcadores negativos')
                item.home_score=args.home;item.away_score=args.away
            else:
                date.fromisoformat(args.date)
                for value in [args.start,args.end]: datetime.strptime(value,'%H:%M')
                if args.start>=args.end: raise ValueError('Horario inválido')
                item.date=args.date;item.start=args.start;item.end=args.end;item.court=args.court
        from datetime import timezone
        s.merge(Metadata(key='imported_at',value=datetime.now(timezone.utc).isoformat()))
    print(validate(engine));print('Guardado en BD. Ejecuta scripts/export_data.py para regenerar la web.')
if __name__=='__main__': main()
