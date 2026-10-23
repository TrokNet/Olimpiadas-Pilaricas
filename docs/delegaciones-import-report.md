# Importación de Delegaciones Franciscanas

Fuente: Delegaciones_Franciscanas_NSP_2026.docx, aportado por el usuario.

Se extrajeron 15 fichas históricas y 15 ilustraciones editoriales. Se excluyeron los códigos QR. La galería reutiliza 14 fotografías locales con atribución y licencia conservadas; las ilustraciones se presentan como ilustraciones, nunca como fotografías.

La extracción conserva nombres, colores y grados del documento en campos sourceGrade/sourceColor/placeName. La interfaz muestra los grados, casas y colores vigentes de SQLite. No se modificaron partidos, códigos TEAM, resultados ni preferencias.

## Diferencias resueltas por identidad del lugar

| Lugar | Word | Calendario vigente conservado |
| --- | --- | --- |
| La Porciúncula | Quinto Primaria / Lila | Sexto Primaria / Celeste |
| Damieta | Sexto Primaria / Celeste | Quinto Primaria / Lila |
| Monte Alvernia | Primero Secundaria / Naranja | Segundo Secundaria / Azul |
| Iglesia San Damián | Segundo Secundaria / Azul | Primero Secundaria / Naranja |

Ex-Alumnas mantiene Nuestra Señora del Pilar, Rosado, conforme a la corrección expresa del usuario. No se asigna país ni santuario; se usa la ilustración de comunidad del Word, sin la fotografía de Rivotorto.

## Fuentes y límites

Se contrastaron las fuentes de la congregación para Saint-Chinian, Montpellier y Mailhac; OFM y el Directorio Franciscano para los lugares italianos y Damieta; el Ayuntamiento de Greccio y Visit Assisi; el directorio de la diócesis de Montpellier para Béziers; y la comunidad de municipios de Hérault para Montpeyroux. Los enlaces históricos del documento se conservan en cada ficha.

El lobo de Gubbio se presenta como tradición religiosa y no como hecho zoológico. Las experiencias religiosas conservan esa atribución. Montpeyroux conserva pendiente su relación con un acontecimiento franciscano particular. Exalumnas no tiene lugar geográfico confirmado. No se descargaron las fotos enlazadas en el Word que no especificaban licencia.

Las imágenes WebP de las 15 ilustraciones suman aproximadamente 201 KB; el conjunto existente de 14 fotografías suma aproximadamente 944 KB. La sección se carga de forma diferida y las fotos de las tarjetas usan carga diferida.

Reextracción: scripts/import_delegations.py. Los originales extraídos se conservan en assets/delegaciones; la fuente estructurada está en src/data/delegations.json.

## Complemento de Ex-Alumnas · 23 de octubre de 2026

A petición del usuario se complementó la ficha Nuestra Señora del Pilar con un resumen de la web oficial: https://nsdelpilar.edu.pe/nosotros/. Incluye la fundación del colegio en Lima en 1954 y la participación de exalumnas en solidaridad, orientación vocacional y Confraternidad Pilarica. El resumen es breve y tiene fuente visible. Se conserva la ilustración comunitaria, el color rosado y la identidad del equipo, sin asignar un santuario. El complemento se guarda en src/data/delegation_updates.json para que una reextracción del Word no lo sobrescriba.
