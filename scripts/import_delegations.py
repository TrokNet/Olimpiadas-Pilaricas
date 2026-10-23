"""Extract the supplied historical guide without changing tournament identities."""
import hashlib
import json
import re
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/Delegaciones_Franciscanas_NSP_2026.docx'
# Match the place, never the row number: four school assignments differ from the guide.
GRADE_IDS = ['3-anos','4-anos','5-anos','primero-primaria','segundo-primaria',
             'tercero-primaria','cuarto-primaria','sexto-primaria','quinto-primaria',
             'segundo-secundaria','primero-secundaria','tercero-secundaria',
             'cuarto-secundaria','quinto-secundaria','ex-alumnas']

def extract():
    ns = {'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    with ZipFile(SOURCE) as archive:
        doc = ET.fromstring(archive.read('word/document.xml'))
        paragraphs = [''.join(t.text or '' for t in p.findall('.//w:t', ns)).strip()
                      for p in doc.findall('.//w:p', ns)]
        paragraphs = [p for p in paragraphs if p]
        starts = [i for i,p in enumerate(paragraphs) if re.match(r'^DELEGACIÓN \d{2}  /', p)]
        assert len(starts) == 15
        records = []
        for index,start in enumerate(starts):
            block = paragraphs[start:starts[index+1] if index < 14 else paragraphs.index('Cómo usarlo en el modelo web')]
            meta = [v.strip() for v in block[2].split('·')]
            location = next(p.removeprefix('Ubicación: ') for p in block if p.startswith('Ubicación: '))
            reference = next(p.removeprefix('Referencia: ') for p in block if p.startswith('Referencia: '))
            category = block[0].split('15', 1)[1].strip()
            history = block[block.index('CONTEXTO HISTÓRICO')+1]
            sources = [p.removeprefix('Historia: ') for p in block if p.startswith('Historia: ')]
            country = location.split(' · ')[0] if index != 14 else None
            records.append({'id':GRADE_IDS[index], 'sourceOrdinal':index+1,
                            'placeName':block[1], 'sourceGrade':meta[0], 'sourceColor':meta[1],
                            'suggestedColor':meta[2], 'category':category,
                            'title':block[4], 'summary':block[5], 'history':history,
                            'location':location if index != 14 else None, 'country':country,
                            'reference':reference, 'sources':sources,
                            'tags':next(p.removeprefix('Etiquetas:  ').split(' · ') for p in block if p.startswith('Etiquetas:')),
                            'illustration':f'delegations/{index+1:02d}.webp',
                            'photoReference':next((p.removeprefix('URL de imagen: ') for p in block if p.startswith('URL de imagen: ')),None),
                            'pending': index in (12,14)})
            folder = ROOT / 'assets/delegaciones'
            folder.mkdir(parents=True,exist_ok=True)
            # Even-numbered images are the full-width illustrations; odd ones are QR codes.
            (folder/f'{index+1:02d}.png').write_bytes(archive.read(f'word/media/image{(index+1)*2}.png'))
    output = {'sourceFile':SOURCE.name,'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
              'illustrationCredit':'Ilustración editorial del documento aportado. No es una fotografía documental.',
              'delegations':records}
    (ROOT/'src/data/delegations.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('15 historias e ilustraciones; 14 lugares. Correspondencias del torneo intactas.')

if __name__ == '__main__':
    extract()
