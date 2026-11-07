# 06 · Setup y convenciones

## Setup (cada miembro del equipo)
```bash
# 1. Clonar ambos repos en la MISMA carpeta padre
git clone https://github.com/Lluis05/UABTheHack-L1SOC-AI-agent.git
git clone https://github.com/dttdfr/DTT-UAB-The-Hack.git

# 2. Entorno Python 3.11
cd UABTheHack-L1SOC-AI-agent
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 3. Configuración
cp .env.example .env               # DATASET_DIR=../DTT-UAB-The-Hack ya apunta bien si clonaste al lado
#    Rellenar GEMINI_API_KEY (gratis en https://aistudio.google.com/apikey)

# 4. Login en Claude Code (si no lo tienes ya)
claude

# 5. Prueba
python -m soc.llm

# 5b. Dashboard (React): necesita Node 18+
cd dashboard/web && npm install && npm run build && cd ../..
uvicorn dashboard.server:app --port 8001          # http://localhost:8001

# 6. API simulada de Deloitte (en otra terminal; la necesita el dashboard para la contención)
cd ../DTT-UAB-The-Hack/06_herramientas
pip install -r requirements.txt
uvicorn mock_soc_api:app --port 8000      # http://localhost:8000/docs
```
Cuidado: la API simulada carga las 11.061 alertas al arrancar y carga cada log entero la primera vez que se consulta.

## Git
- `main` siempre tiene que funcionar.
- Cada uno trabaja en su rama: `feat/data`, `feat/agent`, `feat/dashboard`, etc. Se hace merge a `main` a menudo,
  como mínimo en cada punto de integración.
- Antes de hacer push: `git pull --rebase origin main`.
- **Nunca** `git push --force` a `main`.

### Flujo obligatorio (los 4, y sus Claudes)
**1. Cada persona tiene su propia rama.** Nadie hace commits directamente en `main`.
| Persona | Rama |
|---|---|
| A · Lluis (datos y política) | `feat/data` |
| B (agente IA) | `feat/agent` |
| D (threat hunting, correlación e investigación) | `feat/correlate` |
| C · Adrián (dashboard, contención y pitch) | `feat/dashboard` |

Si hace falta una rama extra (p. ej. `feat/pitch`), se crea a partir de `main` actualizado.

**2. Antes de empezar a trabajar y antes de subir nada, SIEMPRE pull.**
```bash
git checkout main && git pull --rebase origin main     # main al día
git checkout feat/<mi-rama>
git rebase main                                       # traer a mi rama lo último de main
```

**3. Subir mi trabajo a mi rama.**
```bash
git add <ficheros concretos>                          # nada de `git add .` a ciegas
git commit -m "Add alert queue view"
git pull --rebase origin feat/<mi-rama>               # por si lo he tocado desde otro sitio
git push origin feat/<mi-rama>
```

**4. Merge a `main` sin conflictos.** Solo cuando lo de tu rama funciona.
```bash
git checkout main && git pull --rebase origin main    # pull JUSTO antes del merge
git checkout feat/<mi-rama> && git rebase main        # los conflictos se resuelven AQUÍ, en tu rama
# probar que sigue funcionando (al menos `python -m soc.pipeline --random 10 --live` si aplica)
git checkout main && git merge --ff-only feat/<mi-rama>
git push origin main
```
- Si `git merge --ff-only` falla es que `main` ha cambiado mientras tanto: repetir el paso 4 desde el principio.
- **Los conflictos nunca se resuelven en `main`.** Se resuelven en tu rama al hacer `rebase main`.
- Si el conflicto toca ficheros de otra persona, **no lo resuelvas solo**: avisa a su dueño y decidid juntos.
- Si el push a `main` es rechazado, `git pull --rebase origin main` y volver a probar. **Nunca** `--force`.
- Avisa por el chat del equipo cuando hagas merge a `main` ("merge de feat/dashboard en main"), para que los
  demás hagan pull.

**5. Para reducir conflictos:**
- Cada uno toca solo sus módulos (ver [05](05_reparto_y_plan.md)). Ficheros compartidos (`requirements.txt`,
  `docs/`, `CLAUDE.md`, contratos de [04](04_arquitectura.md)): commits pequeños y merge rápido a `main`.
- Commits pequeños y frecuentes; merges a `main` a menudo (mínimo en cada integración: 15:30, 19:00, 03:00).
- Mensajes de commit cortos y en imperativo: `Add severity matrix`, `Fix asset lookup by IP`.
- **Prohibido** añadir `Co-Authored-By: Claude` o "Generated with Claude Code". Solo deben aparecer los miembros del equipo.
- No subir al repo: `.env`, `output/`, el dataset, ficheros de base de datos, `node_modules/` ni `dashboard/web/dist/` (ya están en `.gitignore`).

## Código
- Python 3.11, type hints en las funciones públicas.
- Comentarios y docstrings en castellano; identificadores en inglés.
- Los módulos se comunican con `dict` JSON-serializables (ver [04](04_arquitectura.md)). Nada de objetos que el dashboard no pueda leer de disco.
- Dependencias nuevas: añadirlas a `requirements.txt` en el mismo commit y avisar al equipo.
- Las rutas se leen siempre de `soc/config.py` (variables de `.env`), nunca escritas a mano en el código.

### Principios de código (aplican a todo el proyecto)
- Antes de escribir algo nuevo, busca si ya existe una función, componente o hook que lo cubra. Reutiliza o extiende; no dupliques.
- Abstrae cuando haya repetición real (segunda o tercera aparición). No crees abstracciones especulativas "por si acaso".
- Funciones pequeñas con una única responsabilidad, nombres descriptivos y sin efectos secundarios ocultos.
- Bajo acoplamiento: depende de interfaces, no de implementaciones concretas. Sin dependencias circulares.
- Sin números ni cadenas mágicas: constantes y configuración centralizadas.
- Los comentarios explican el porqué, no el qué.
- La lógica reutilizable lleva tests (`pytest` en Python, `vitest` en el frontend).
- Antes de dar una tarea por terminada, revisa que no hayas introducido código duplicado.

### Frontend (React + Material UI) — `dashboard/web/`
Jerarquía de tres niveles:
1. **Componentes base** (`src/components/base`): envoltorios de los componentes de Material con nuestras props,
   variantes y estilos. Son la única puerta de entrada a MUI.
2. **Componentes compuestos** (`src/components/shared`): formularios, tablas, diálogos y otros bloques construidos
   solo con componentes base.
3. **Pantallas** (`src/pages`): únicamente componen componentes de los niveles 1 y 2.

Reglas:
- No uses componentes de MUI directamente en las pantallas: usa los componentes base. Si falta una propiedad,
  añádela al componente base.
- Antes de crear un componente, revisa `src/components`.
- Estilos a través del tema (`src/theme.js`), no estilos en línea sueltos.
- La lógica y las llamadas a la API van en hooks (`src/hooks`) y servicios (`src/services`) propios; los componentes
  de presentación no hacen peticiones.
- Constantes y etiquetas en `src/config/`; lógica pura en `src/utils/` con sus tests.

Skills de frontend instaladas en `.claude/skills/` (sacadas de skills.sh; ver su `README.md`). Claude Code las usa solas:
- **frontend-design:** el plan de diseño está al principio de `src/theme.js`. Lo memorable es el código de colores
  Política / IA / Persona; el resto, sobrio. Sin etiquetas en MAYÚSCULAS, sin flechas decorativas y sin tarjetas idénticas.
- **vercel-react-best-practices:** imports directos de MUI (`@mui/material/Button`, nunca `from '@mui/material'`),
  `? :` en lugar de `&&` con números y `content-visibility` en la cola.
- **vercel-composition-patterns:** variantes explícitas (`variant`, `emphasis`, `direction`) en lugar de props
  booleanas, y componentes compuestos con `children` (`TriageProgress.Alert`) en lugar de render props.
- **web-design-guidelines:** etiqueta visible en todos los campos, texto de ejemplo y estados de carga acabados en `…`,
  `role="status"` y `role="alert"` en los mensajes, la pestaña y el ticket en la URL, `prefers-reduced-motion`,
  `translate="no"` en identificadores y cifras tabulares. Para revisar: `/web-design-guidelines dashboard/web/src`.

## Cómo trabajar con tu Claude
Dile al empezar:
> Lee CLAUDE.md y docs/. Soy la Persona X. Trabaja solo en mis módulos y respeta los contratos de docs/04_arquitectura.md.

Si tu Claude descubre algo del dataset (una trampa, un incidente, un patrón raro), debe añadirlo a `docs/09_hallazgos.md`.
