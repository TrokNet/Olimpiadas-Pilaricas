"""Copia portable, exige destino vacío. Ej.: --target postgresql+psycopg://..."""
import argparse
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from sqlalchemy import select, func, insert
from backend.database import Base, engine_for, initialize

def migrate(source_url,target_url):
    source=engine_for(source_url); target=engine_for(target_url); initialize(source); initialize(target)
    with source.connect() as src, target.begin() as dst:
        tables=Base.metadata.sorted_tables
        if any(dst.scalar(select(func.count()).select_from(t)) for t in tables): raise ValueError('Destino no vacío: no se sobrescribirá')
        for table in tables:
            rows=[dict(r) for r in src.execute(select(table)).mappings()]
            if rows: dst.execute(insert(table),rows)
            if dst.scalar(select(func.count()).select_from(table)) != len(rows): raise ValueError(f'Conteo incorrecto: {table.name}')
    return True
if __name__=='__main__':
    p=argparse.ArgumentParser(); p.add_argument('--source'); p.add_argument('--target',required=True); args=p.parse_args(); migrate(args.source,args.target); print('Migración validada; origen conservado.')
