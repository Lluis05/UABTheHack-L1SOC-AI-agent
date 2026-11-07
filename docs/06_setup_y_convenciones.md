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
- No subir al repo: `.env`, `output/`, el dataset ni ficheros de base de datos (ya están en `.gitignore`).

## Código
- Python 3.11, type hints en las funciones públicas.
- Comentarios y docstrings en castellano; identificadores en inglés.
- Los módulos se comunican con `dict` JSON-serializables (ver [04](04_arquitectura.md)). Nada de objetos que el dashboard no pueda leer de disco.
- Dependencias nuevas: añadirlas a `requirements.txt` en el mismo commit y avisar al equipo.
- Las rutas se leen siempre de `soc/config.py` (variables de `.env`), nunca escritas a mano en el código.

## Cómo trabajar con tu Claude
Dile al empezar:
> Lee CLAUDE.md y docs/. Soy la Persona X. Trabaja solo en mis módulos y respeta los contratos de docs/04_arquitectura.md.

Si tu Claude descubre algo del dataset (una trampa, un incidente, un patrón raro), debe añadirlo a `docs/09_hallazgos.md`.
