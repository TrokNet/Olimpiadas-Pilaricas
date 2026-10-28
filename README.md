# Olimpiadas Pilaricas 2026

Aplicación React/TypeScript/Vite con portada fotográfica fija, selector de equipo con carrusel 3D, fixture filtrable, favoritos independientes por categoría, detalle compartible y calendario ICS. Diseño coral, negro y blanco, tipografías alojadas localmente, modo oscuro/claro y movimiento reducido.

## Iniciar en Windows

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
npm ci
.\.venv\Scripts\python scripts/export_data.py
npm run dev
```

La aplicación se sirve en la URL local indicada por Vite. `npm run build` genera `dist/`; `npm run preview` sirve esa compilación.

## Fuente de datos: SQLite

`data/olimpiadas.db` es ahora la fuente principal. Contiene 15 identidades de grado/equipo, 68 participaciones por disciplina y los 162 registros del fixture, incluidas reservas y las 20 entradas de fases finales. No contiene datos personales de alumnos.

- `grades`: grado, nombre oficial y color. La identidad del equipo se comparte entre disciplinas.
- `entries`: código TEAM específico del sorteo y disciplina, con FK a su grado. La clave incluye ambas partes: `voley-femenino:TEAM-10`.
- `matches`: programación, referencias de equipos, marcadores opcionales, etiquetas originales y referencia a hoja/fila.
- `metadata`: versión del esquema, fecha de actualización y huella del Excel de importación.

La migración inicial se hizo desde el Excel validado, conservado en `data/olimpiadas.xlsx` como respaldo. Los nombres vigentes son los del PDF de disciplinas: Mont Peller, Espoleto, Monte Alvernia e Iglesia San Damian. Ex-Alumnas usa la casa Nuestra Señora del Pilar (Rosado); 4 Años conserva Rivotorto. La corrección aprobada se conserva al reimportar mediante `data/grade_name_overrides.json`.

GitHub Pages no ejecuta SQLite ni Python en el servidor. Durante la compilación, `scripts/export_data.py` lee SQLite y genera el JSON que consume el navegador. El archivo `.db` y los datos internos de origen no se copian a `dist/`. Para actualizar los datos se modifica la BD, se guarda en Git y Actions regenera/publica el sitio. **No se reimporta Excel automáticamente** para no perder cambios hechos directamente en la BD.

### Administración local

```powershell
python scripts/manage_data.py validate
python scripts/manage_data.py team-name primero-primaria "Espoleto"
python scripts/manage_data.py result ID_DEL_PARTIDO 2 1
python scripts/manage_data.py schedule ID_DEL_PARTIDO --date 2026-10-31 --start 12:30 --end 13:20 --court "VÓLEY – Cancha 1"
python scripts/manage_data.py participants ID_DEL_PARTIDO --home voley-femenino:TEAM-10 --away voley-femenino:TEAM-11
python scripts/export_data.py
```

Los ejemplos de marcador son sintaxis; no se cargaron resultados inventados. La web muestra marcadores solo cuando ambos existen. No calcula posiciones sin reglas oficiales de puntuación. Las fases finales permanecen pendientes hasta confirmar los participantes.

Para habilitar tablas de posiciones, cargar un JSON con reglas **oficiales** mediante `python scripts/manage_data.py rules reglas_confirmadas.json`. El objeto se indexa por disciplina e incluye `win`, `draw`, `loss` (puntos), `allow_draw` (booleano) y `tiebreakers` (lista ordenada con las claves oficiales entre `points`, `wins`, `difference`, `for`). Se guarda en SQLite; no se incluyeron reglas supuestas. El comando `participants` permite confirmar los clasificados de una semifinal/final sin alterar IDs del partido.

### Reimportar Excel explícitamente

```powershell
python scripts/import_excel.py --excel data/olimpiadas.xlsx
python scripts/export_data.py
```

Esta operación reemplaza los datos de torneo de manera transaccional. Se valida la fuente completa antes de modificar la BD. **Reimportar puede sustituir cambios de horarios, nombres y marcadores heredados del Excel. Los resultados del registro web se conservan por UUID estable en `match_results`**; conservar una copia de la BD si se desea preservar una edición anterior. El adaptador de hojas/columnas está en `data/import_config.json`. La hoja Equipos web aporta correspondencias/nombres; Fixture web aporta los partidos. Se preservan fuente y filas originales. Identificadores de partidos determinísticos por disciplina, fase y enfrentamiento (reservas por fecha/hora/cancha) toleran cambios de horario y orden de filas.

## PostgreSQL después

Todo el modelo usa SQLAlchemy y tipos portables. No se ha migrado a PostgreSQL todavía ni es necesario instalarlo.

```powershell
pip install "psycopg[binary]>=3.2,<4"
python scripts/migrate_database.py --source sqlite:///data/olimpiadas.db --target "postgresql+psycopg://USER:PASSWORD@HOST/DB"
$env:DATABASE_URL="postgresql+psycopg://USER:PASSWORD@HOST/DB"
python scripts/manage_data.py validate
python scripts/export_data.py
```

El destino debe estar vacío; la herramienta conserva el origen y compara los conteos. Para despliegue con servidor Python existe la API local de consulta y registro `uvicorn backend.api:app`, con `/api/tournament`, `/api/matches/{id}` y documentación `/docs`. La web estática actual usa el JSON generado de la misma BD. La conexión PostgreSQL debe guardarse como secreto del entorno/Actions, nunca dentro del repositorio.

## Preferencias del visitante

El equipo principal se elige por grado/nombre; se resuelve en cada disciplina con su TEAM propio. Ver otro equipo es temporal y no modifica el principal. Hasta 3 favoritos por cada una de las 5 categorías, persistidos en `localStorage` junto al tema. Sin login; las preferencias no se sincronizan entre dispositivos. El estado de filtros se conserva en la URL y cada partido tiene un enlace hash compatible con GitHub Pages.

## Verificación por terminal

```powershell
python -m unittest discover -s tests -v
npm test
npm run lint
npm run build
```

Las pruebas de Three usan `@react-three/test-renderer`: geometría volumétrica real, avance de fotogramas, interacción de balones y movimiento reducido. No toman control del navegador. No equivalen a mediciones de FPS/GPU en un teléfono físico; estas requieren validación del dispositivo. El carrusel ofrece flechas, teclado, lista nativa y gesto táctil. Si WebGL falla, se mantiene el selector accesible. Los filtros/textos no participan de movimientos continuos.

## Publicar en GitHub Pages

Crear un repositorio `olimpiadas-pilaricas-2026`, subir **esta carpeta como raíz del repositorio** y seleccionar Settings → Pages → Source: GitHub Actions. El flujo `.github/workflows/deploy.yml` valida SQLite, ejecuta pruebas, genera JSON y despliega `dist/`. La ruta base usa el nombre real del repositorio. El flujo también puede iniciarse manualmente.

```powershell
git init -b main
git add .
git commit -m "Build Olimpiadas Pilaricas 2026 with SQLite and interactive 3D"
gh repo create olimpiadas-pilaricas-2026 --public --source . --remote origin --push
```

El despliegue público necesita un repositorio y autenticación GitHub. El código no incluye credenciales. Para dominios en la raíz puede compilarse con `VITE_BASE_PATH=/`.

## Referencias visuales y rediseño

`public/teams/` contiene 14 fotografías con licencia reutilizable. La atribución, el lugar y la URL original están en `data/team_visuals.json`, en los metadatos de SQLite y en la ruta `#imagenes`. `scripts/fetch_team_images.py` reproduce la selección curada. Son referencias patrimoniales, no escudos oficiales. Mont Peller y Mont Peyroux conservan sus nombres del torneo; las fotografías son referencias geográficas, no nuevas correspondencias de equipos.

El carrusel usa texturas sobre geometría Three, sin etiquetas HTML que puedan atravesar tarjetas. Muestra tres tarjetas físicamente separadas y conserva gesto táctil, teclado, flechas y lista nativa. El detalle de cada partido usa una composición compacta con fotografía de ambos equipos, grados, fecha, horario y cancha. Las verificaciones se realizan desde terminal; la revisión visual en navegadores y dispositivos físicos queda a cargo del usuario.

## Portada con modelos GLB

La portada carga `public/models/{trophy,football,basketball,volleyball}.glb` con `useGLTF`. Los cuatro objetos usan mallas externas, con geometría y materiales independientes de los controles de interacción. No se crean el trofeo ni los balones con primitivas en el código React. El suelo y los elementos del escenario conservan su geometría simple.

Fuentes y licencias: `assets/LICENSES.md`, `src/data/assetCredits.json` y la página `#imagenes`. Trofeo de Casey Tumbers (CC BY 3.0), balones de dLeom (CC0), normal de cuero de Rob Tuytel (CC0) y HDRI Studio Small 09 de Sergej Majboroda (CC0). El trofeo tiene refinamiento de superficie y materiales nuevos; no es un modelo oficial del torneo. Spline no está conectado y esta versión utiliza React Three Fiber, sin dependencia del editor de Spline.

Preparación reproducible con Blender 4.5 y Node:

```powershell
blender --background --factory-startup --python scripts/prepare_models_blender.py
node scripts/optimize_models.mjs
npm run assets:check
blender --background --factory-startup --python scripts/render_models_blender.py
```

Se conservan los GLB de origen y la normal original en `assets/`. La preparación fija orientación y pivotes, refina la superficie del trofeo y asigna materiales. glTF Transform elimina datos redundantes, genera tangentes MikkTSpace, empaqueta normales WebP de 512 px y valida presupuestos. No se requiere un decodificador externo Draco o Meshopt. Los modelos suman aproximadamente 1,2 MB, más 1,6 MB del HDRI. La compilación valida los cuatro GLB y excluye fuentes de trabajo y BD de la publicación.

Las pruebas de escena cargan la geometría real mediante GLTFLoader; no decodifican texturas en un navegador. La integridad de mapas y formato se valida por separado. Se proyectan los vértices de los GLB en cinco proporciones de pantalla con giro y hover para detectar recortes. El render de Blender permite revisar los activos y materiales, pero no equivale a una captura del navegador ni a una medición de FPS en un celular.

## Portada estática (preferencia actual)

La portada y la cabecera de finales ahora usan `public/images/olimpiadas-hero.webp`, una imagen fija generada para el proyecto. El original está en `assets/olimpiadas-hero.png`; la versión de 800 px se usa mediante `srcSet` en pantallas pequeñas. La fotografía no tiene parallax, zoom ni animación. Los botones de disciplinas conservan el acceso al fixture y ya no esperan una transición 3D.

Los modelos GLB y su documentación se conservan como recursos de la versión anterior, pero ya no se renderizan en la portada ni en finales. El selector de equipos permanece independiente.


## Simulador y registro de resultados

Abrir `#gestion` desde «Simulación». El registro oficial está separado en `#resultados/registrar`, sin selector de simulación.

- **Simulación:** abre las tablas de grupos y todos sus partidos con resultados reales por defecto. Permite editar goles/puntos junto a cada encuentro, o sets, tarjetas y W.O. en el editor. Recalcula las posiciones al aplicar, distingue Real/Simulado y permite restablecer un partido o todos. Cada nueva visita empieza de la información oficial; los cambios viven solo en memoria y no se envían a la API. Si faltan reglas oficiales, las propuestas se identifican como reglas de prueba.
- **Registro en SQLite:** guarda mediante `PUT /api/results/{id}` en la tabla `match_results`. El registro conserva los mismos UUID del fixture; no modifica fechas, horarios, rivales ni el Excel. Reimportar el mismo fixture conserva estos resultados. El exportador integra resultados y estadísticas en el JSON que se publica para GitHub Pages.
- Las tablas calculan PJ, PG, PE, PP, puntos de clasificación, goles/tantos a favor y en contra, diferencia, amarillas, rojas y walkovers ganados/perdidos. El orden de desempate es configurable; si sigue habiendo igualdad, los equipos comparten posición. Las tarjetas no aplican descuentos automáticos.
- En vóley, los sets deciden el ganador y los tantos de cada set determinan PF/PC. No se deduce el ganador por la suma de tantos ni se impone un formato de sets sin reglamento confirmado. Se rechazan sets empatados, valores negativos, resultados de reservas o partidos con participantes pendientes y empates de eliminación.
- W.O. indicado por el usuario: fútbol **3–0**; vóley **2–0**, sets **25–0 y 25–0** (50–0 tantos); básquet **20–0**. Ganador: **3 puntos** en todos. El sistema genera estos marcadores administrativos al elegir al equipo ausente. La doble inasistencia se registra 0–0 y sin ganador; el valor inicial de puntos para ausentes es 0 y puede configurarse.
- Los puntos de victoria normal, empate, derrota y los desempates se muestran como propuestas editables. Antes de registrar, el usuario debe confirmar y guardar las reglas de cada categoría mediante `PUT /api/rules/{sport}`. Las reglas oficiales y las de simulación se guardan separadas.

### Arranque local completo

```powershell
npm run local
```

Este comando inicia FastAPI en `127.0.0.1:8000` y Vite en `127.0.0.1:5173`. También puede usarse `python -m uvicorn backend.api:app --host 127.0.0.1 --port 8000` junto con `npm run preview -- --port 5173` después de compilar. Los puertos deben estar libres. El proxy `/api` funciona tanto en desarrollo como en preview. Las escrituras están limitadas al servidor local y se rechazan orígenes web externos; un alojamiento público con escritura requerirá autenticación antes de habilitar administración remota.

En GitHub Pages, la consulta y la simulación siguen funcionando; guardar en SQLite requiere el servidor Python. No se simula una confirmación de guardado cuando la API no está disponible o rechaza el resultado. Los resultados oficiales de esta entrega siguen vacíos: las pruebas de escritura se ejecutaron en bases temporales.

Pruebas adicionales: escenarios persistidos en navegador, separación de registro y simulación, marcadores administrativos en los tres deportes, ganador de vóley por sets aunque tenga menos tantos, tarjetas y diferencias, errores de almacenamiento y conexión, rechazo de datos inválidos, persistencia al reimportar Excel y endpoints de escritura contra SQLite real en bases temporales.

## Grupos y Eliminatorio

El menú separa `#grupos` y `#eliminatorio`. Grupos muestra tablas de posiciones por disciplina (PJ, PG, PE, PP, PF, PC, DIF y PTS), filtros por grupo, progreso y partidos desplegables con acceso al detalle o al calendario filtrado. Usa las reglas de puntuación configuradas; los equipos empatados comparten posición y el orden sin resultados no implica clasificación. Eliminatorio muestra semifinales, gran final, tercer puesto y campeón cuando corresponde. Conserva la disciplina al alternar de vista. El enlace antiguo `#finales` abre Eliminatorio. Simulación muestra las tablas de grupos y sus partidos editables.

Los grupos se derivan de participantes de partidos oficiales, excluyendo reservas. Se conserva el significado original de `FINAL 1` (tercer puesto) y `FINAL 2` (gran final). Fútbol conserva primero A contra segundo B y primero B contra segundo A; básquet femenino conserva el cruce con «Mejor 2do». No se asignan clasificados automáticamente ni se inventan reglas para comparar grupos. Si un participante está pendiente, se conserva la etiqueta del fixture. El cuadro es horizontal en escritorio y apilado, legible y sin desplazamiento obligatorio en celulares.

La vista Eliminatorio usa una composición de campeonato con copa central estática (`public/images/tournament-cup.webp`, 93 KB, transparencia), dos rutas desde semifinales hacia la final y tercer puesto. El original generado se conserva en `assets/tournament-cup.png`. En móviles, la copa precede a semifinales y final; se conserva el aviso del escenario simulado.

## Delegaciones Franciscanas

El botón «Delegaciones Franciscanas» abre `#delegaciones`, con 15 tarjetas, búsqueda por casa/grado, filtros por nivel y país, historias, fotografías acreditadas e ilustraciones del Word. Cada historia tiene enlace compartible `#delegaciones/<grade-id>`, navegación anterior/siguiente y acceso al calendario del equipo. La sección se carga de forma diferida.

`docs/Delegaciones_Franciscanas_NSP_2026.docx` es la fuente documental conservada; `scripts/import_delegations.py` extrae las fichas a `src/data/delegations.json`. Los archivos `sourceGrade` y `sourceColor` conservan el texto original; la vista usa las identidades vigentes de la base de datos. Las diferencias y referencias pendientes están en `docs/delegaciones-import-report.md`. No se cambian las correspondencias del torneo.

## Recorrido narrativo por scroll

`#delegaciones` incorpora `AtlasJourney.tsx`: portada fotográfica con parallax y título que se desplaza y desvanece, seguida de 15 capítulos. Las fotografías son sticky durante aproximadamente 1,35 pantallas por capítulo en escritorio (1,15 en móvil), mientras el texto avanza con el scroll normal. El directorio filtrable sigue al recorrido y la portada ofrece acceso directo para saltar la narración. Los enlaces de detalle y los datos históricos se conservan.

Se usa Motion ya instalado: `useScroll`, `useTransform` y MotionValues actualizan transform/opacity sin renders React por cada frame. Motion administra y limpia sus suscripciones al desmontar; no se añaden listeners de rueda/tacto, scroll snapping ni bloqueos del scroll. El contenedor de esta vista usa `overflow: clip` para no invalidar el posicionamiento sticky. Las imágenes mantienen carga diferida y la sección completa conserva su carga diferida.

Con `prefers-reduced-motion` no se montan los componentes que se suscriben al scroll: las fotos y textos se presentan estáticos, sin sticky, parallax ni revelados. Las pruebas controlan MotionValues para verificar desplazamiento, escala, opacidad y progreso, y comprueban que el modo reducido mantiene las 15 historias sin suscripciones al scroll. No se utiliza automatización del navegador.

## Fans

`#fans` ofrece mensajes de aliento por equipo, nombre opcional, fecha/hora de Lima, filtros e historial paginado. Los mensajes se guardan en la tabla portable `fan_messages` de SQLite, independiente del Excel y de los resultados. La importación del fixture no los borra; la migración de base de datos los copia.

API: `GET /api/fans` (team_id/cursor/limit), `POST /api/fans` y `DELETE /api/fans/{id}`. El borrado requiere la clave en el cuerpo JSON y se valida en el servidor contra un hash scrypt con salt. La configuración privada está en `.local/fans_admin.json`, ignorada por Git y fuera de la web pública. Para cambiarla, ejecutar `python scripts/configure_fans_admin.py`; no pasar la clave en la URL ni incorporarla al frontend. La clave se pide en cada borrado, sin guardarla en el navegador. Se limitan longitud de mensajes e intentos por minuto; el contenido se representa como texto, nunca como HTML.

La vista provisional pública ahora se sirve con `uvicorn backend.public_preview:app --host 127.0.0.1 --port 5174`. Sirve dist, consulta del torneo y API Fans; no expone los endpoints de edición de reglas/resultados oficiales. El túnel existente conserva su URL. Fans requiere ese servidor: un despliegue exclusivamente estático no comparte ni guarda mensajes. El acceso local en 5173 usa la API habitual de 8000, que también incluye Fans.

Pruebas: mensajes compartidos, filtros/paginación, publicación, claves incorrectas, borrado autenticado, contenido como texto, reintentos de conexión, persistencia al reimportar, migración portable y cierre de endpoints oficiales en el acceso público. Las pruebas de escritura usan bases temporales; el historial real comienza vacío.

## Acceso protegido para resultados

La aplicación de servidor (`backend.public_preview:app`) permite iniciar sesión en `#resultados/registrar`. Cada cuenta de salón se vincula al ID estable del grado; sus códigos TEAM se resuelven por disciplina. Puede registrar ambos marcadores únicamente cuando participa ese grado. El administrador puede registrar cualquier partido y configurar reglas. Si el reglamento de una disciplina sigue pendiente, debe confirmarlo el administrador antes de registrar resultados.

Crear una sola vez las 15 cuentas de equipo y el administrador:

```sh
.venv/bin/python scripts/provision_accounts.py
```

Las contraseñas aleatorias se entregan una sola vez en `.local/credenciales-equipos.csv`, con permisos privados. No agregar este archivo a Git ni publicarlo en `dist`. La BD conserva únicamente hashes scrypt con sal individual. Las sesiones duran 12 horas, usan cookies HttpOnly/SameSite Strict (Secure bajo el dominio público), y se revocan al cerrar sesión. Cada guardado autenticado queda registrado en `result_audit` con usuario, partido y marcador. El script de creación rechaza reemplazar cuentas existentes.

El acceso anónimo conserva calendarios, resultados y Fans; las rutas públicas de escritura exigen autenticación y verifican permisos en el servidor. Las reglas solo pueden modificarse con la cuenta administradora. GitHub Pages por sí solo no ejecuta estas funciones: requieren el servidor Python y su BD persistente.

## Horarios actualizados el 26/10/2026

`data/schedule_updates_20261026.json` conserva las 66 programaciones cotejadas contra los PDF y la captura recibida: 42 de fútbol, 18 de vóley masculino y 6 correcciones de otras disciplinas para Fonte Colombo. La actualización modifica 58 partidos respecto del fixture inicial. Los PDF de fútbol prevalecen sobre la captura cuando difieren; las fuentes y sus huellas se conservan en `docs/fixture-20261026/`.

```sh
.venv/bin/python scripts/apply_schedule_updates.py
.venv/bin/python scripts/export_data.py
```

El proceso es transaccional e idempotente: verifica las identidades de ambos equipos y solo modifica fecha, inicio, fin y cancha. Conserva cuentas, sesiones, resultados, auditoría y Fans. La reimportación explícita del Excel también aplica estas correcciones para no recuperar horarios antiguos. Ex-Alumnas conserva Rosado / Nuestra Señora del Pilar según la instrucción del usuario. Las reservas ocupadas por partidos oficiales se conservan en SQLite y en el JSON con `superseded_by`, pero dejan de aparecer como horarios disponibles en el calendario.
En Debian, la BD activa se mantiene fuera de Git en `.local/olimpiadas-live.db`; el servicio usa `DATABASE_URL` para apuntar a ella. `data/olimpiadas.db` es únicamente la base inicial distribuida con el código. Ejecutar las herramientas de administración con el mismo `DATABASE_URL` del servicio y conservar respaldos privados antes de actualizar.

## Estadísticas privadas de audiencia

El enlace «Administración» del pie lleva a `#administracion`. Solo el usuario administrador puede consultar `GET /api/admin/analytics`; los demás reciben 401/403. El panel se actualiza cada 30 segundos y permite ver todo el historial disponible, 7 o 30 días, con tabla diaria. Las respuestas privadas no se almacenan en caché.

`POST /api/analytics/heartbeat` recibe un UUID anónimo por navegador, compartido entre pestañas mediante localStorage. El servidor solo conserva su hash, primera/última actividad, sesiones y presencia diaria en tablas SQLite portables. No guarda IP, URL, nombres ni user-agent. Se cuenta «conectado» durante 120 segundos desde la última señal de una pestaña visible; una visita nueva comienza tras 30 minutos sin actividad. Los acumulados identifican navegadores, no personas verificadas. Borrar el almacenamiento, cambiar de dispositivo o bloquear JavaScript afecta al conteo. Este servicio usa un único proceso Uvicorn; si se amplía a múltiples procesos, la creación de sesiones debe serializarse en la base de datos.

Para recuperar registros antiguos de Debian, conservar una copia privada del journal y ejecutar con la BD activa:

```sh
export DATABASE_URL=sqlite:////home/trok/apps/olimpiadas/.local/olimpiadas-live.db
.venv/bin/python -m scripts.import_access_history .local/access-history/journal-before-analytics.jsonl
```

La importación es idempotente y conserva únicamente huellas y fechas de respuestas HTML `GET /` con estado 200 anteriores al inicio del nuevo conteo. Esos accesos aparecen separados: incluyen recargas, posibles bots y consultas técnicas; no equivalen a visitantes únicos ni garantizan cobertura completa desde la creación del sistema. Los registros disponibles comienzan el 23/10/2026. No se reconstruyen cifras inexistentes. El archivo original del journal, las credenciales y la BD activa permanecen fuera de Git y de `dist`.
