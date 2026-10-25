"""One-time provisioning. Plaintext credentials are written only to a private file."""
import csv
import os
import secrets
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from sqlalchemy import select
from sqlalchemy.orm import Session
from backend.database import ROOT, Account, Grade, engine_for, initialize
from backend.auth import password_hash

def provision(engine,output):
    initialize(engine)
    target=Path(output)
    if target.exists():raise ValueError('El archivo de credenciales ya existe; no se reemplazó.')
    rows=[]
    with Session(engine) as s,s.begin():
        if s.scalar(select(Account.username).limit(1)):raise ValueError('Ya hay cuentas; no se cambiaron contraseñas.')
        grades=list(s.scalars(select(Grade).order_by(Grade.display_order)))
        for username,role,grade,label in [(g.id,'team',g.id,g.name+' / '+g.label) for g in grades]+[('administrador','admin',None,'Administrador general')]:
            password=secrets.token_urlsafe(12);salt=secrets.token_hex(16)
            s.add(Account(username=username,password_hash=password_hash(password,salt),salt=salt,role=role,grade_id=grade))
            rows.append({'equipo':label,'usuario':username,'contrasena':password,'acceso':'https://olimpiadas.trok.dev/#resultados/registrar'})
        target.parent.mkdir(parents=True,exist_ok=True)
        descriptor=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(descriptor,'w',encoding='utf-8-sig',newline='') as f:
            writer=csv.DictWriter(f,fieldnames=['equipo','usuario','contrasena','acceso']);writer.writeheader();writer.writerows(rows)
    return len(rows)

if __name__=='__main__':
    print('Cuentas creadas:',provision(engine_for(),ROOT/'.local/credenciales-equipos.csv'))
