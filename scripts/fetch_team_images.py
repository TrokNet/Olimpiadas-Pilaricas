"""Activos curados de Commons: conserva fotógrafo, licencia y página original."""
import html
import json
import re
import sys
import time
import urllib.request
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from backend.database import ROOT, Metadata, engine_for
from sqlalchemy.orm import Session

# Selección revisada por lugar; no usar automáticamente el primer resultado de búsqueda.
CHOICES={
 'fonte-colombo':('fonte-colombo','Fonte Colombo 1.jpg','Santuario de Fonte Colombo','Rieti · Italia'),
 'rivotorto':('rivotorto','Santuaro Rivotorto front','Santuario de Rivotorto','Asís · Italia'),
 'mont-peller':('mont-peller','- Facade.jpg','Catedral de Saint-Pierre','Montpellier · Francia'),
 'espoleto':('espoleto','Eremo francescano. Monteluco di Spoleto.jpg','Ermita franciscana de Monteluco','Spoleto · Italia'),
 'greccio':('greccio','Greccio PanoramaSantuario','Santuario de Greccio','Greccio · Italia'),
 'gubbio':('gubbio','Chiesa di San Francesco - esterno','Iglesia de San Francisco','Gubbio · Italia'),
 'damieta':('damieta','Giotto-St Francis before the Sultan small','San Francisco ante el sultán · Giotto','Damieta · Egipto'),
 'porciuncula':('porciuncula','Portiuncula on the Feast','Capilla de la Porciúncula','Asís · Italia'),
 'san-damian':('san-damian','San Damiano (Assisi) - Cloisters','Claustro de San Damiano','Asís · Italia'),
 'monte-alvernia':('monte-alvernia',"L'ingresso",'Santuario de La Verna','Toscana · Italia'),
 'mailhac':('Category:Mailhac','Pano Mailhac.jpg','Paisaje histórico de Mailhac','Mailhac · Francia'),
 'mont-peyroux':('Category:Montpeyroux (Hérault)','statue Saint Roch','Imagen de San Roque en Montpeyroux','Hérault · Francia'),
 'beziers':('beziers','Pont Vieux et Cathédrale Saint-Nazaire.jpg','Catedral de Saint-Nazaire','Béziers · Francia'),
 'saint-chinian':('Category:Saint-Chinian','Saint-Chinian cloitre.JPG','Claustro de la antigua abadía','Saint-Chinian · Francia'),
}
GRADES={'3-anos':'saint-chinian','4-anos':'rivotorto','5-anos':'mont-peller','primero-primaria':'espoleto','segundo-primaria':'greccio','tercero-primaria':'gubbio','cuarto-primaria':'fonte-colombo','quinto-primaria':'damieta','sexto-primaria':'porciuncula','primero-secundaria':'san-damian','segundo-secundaria':'monte-alvernia','tercero-secundaria':'mailhac','cuarto-secundaria':'mont-peyroux','quinto-secundaria':'beziers','ex-alumnas':'rivotorto'}

def main():
    candidates=json.loads((ROOT/'data/team-image-candidates.json').read_text(encoding='utf8'))
    folder=ROOT/'public/teams';folder.mkdir(parents=True,exist_ok=True)
    selected={}
    for key,(group,needle,place,country) in CHOICES.items():
        item=next(v for v in candidates[group] if needle in v.get('title',''))
        if item['license'] not in ['CC BY 2.0','CC BY 3.0','CC BY 4.0','CC BY-SA 2.5','CC BY-SA 3.0','CC BY-SA 4.0','CC0','Public domain']:raise ValueError(f'Licencia no revisada: {key}')
        target=folder/f'{key}.jpg'
        if not target.exists():
            for attempt in range(4):
                try:
                    request=urllib.request.Request(item['url'].split('?')[0],headers={'User-Agent':'Pilaricas2026/1.0 (educational project; image attribution retained)'})
                    with urllib.request.urlopen(request,timeout=45) as response:
                        if not response.headers.get('Content-Type','').startswith('image/'):raise ValueError('El recurso no es una imagen')
                        target.write_bytes(response.read())
                    break
                except Exception:
                    if attempt==3:raise
                    time.sleep(2*(attempt+1))
        author=html.unescape(re.sub('<[^>]+>','',item.get('author') or 'Autor indicado en la fuente')).strip()
        if 'Timothy A. Gonsalves' in author:author='Timothy A. Gonsalves'
        selected[key]={'image':f'teams/{key}.jpg','place':place,'country':country,'source':item['source'],'author':author,'license':item['license'],'licenseUrl':item.get('licenseUrl') or item['source'],'reference':'Referencia visual del lugar o patrimonio religioso. No es un emblema oficial del equipo.'}
        print(key,target.stat().st_size,flush=True)
        time.sleep(.2)
    art={grade:selected[key] for grade,key in GRADES.items()}
    (ROOT/'data/team_visuals.json').write_text(json.dumps(art,ensure_ascii=False,indent=2),encoding='utf8')
    with Session(engine_for()) as session,session.begin():session.merge(Metadata(key='team_art',value=json.dumps(art,ensure_ascii=False)))
    print('15 grados, 14 fotografías distintas, fuentes y licencias guardadas en SQLite.')

if __name__=='__main__':main()
