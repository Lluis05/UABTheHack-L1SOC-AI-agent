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
