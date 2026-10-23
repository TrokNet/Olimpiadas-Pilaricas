"""Configure the private deletion key without adding it to the website or repo."""
import getpass
import hashlib
import json
import secrets
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from backend.database import ROOT

def set_password(password,path=None):
    if not password or len(password)>128: raise ValueError('La clave debe tener entre 1 y 128 caracteres.')
    salt=secrets.token_bytes(16)
    digest=hashlib.scrypt(password.encode(),salt=salt,n=16384,r=8,p=1).hex()
    target=Path(path or ROOT/'.local/fans_admin.json')
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps({'salt':salt.hex(),'hash':digest}),encoding='utf-8')

if __name__=='__main__':
    set_password(getpass.getpass('Clave para borrar mensajes: '))
    print('Clave privada configurada en el servidor.')
