# Presentación interactiva del pipeline

Web de presentación para la defensa: explica cómo funciona nuestro agente N1 paso a paso, con **ejecuciones reales**
del pipeline (no con datos inventados). Es el apoyo del punto «hasta qué nivel habéis llegado y cómo lo habéis
construido»; la demo en directo de las 10 alertas se hace en el dashboard.

## Diapositivas (3 minutos)
0. **Vídeo de la demo** (primero, antes de la portada) · 1. Portada (lema y el problema en una línea) ·
**2. El pipeline interactivo** · 3. Resultados medidos y niveles del reto · 4. Limitaciones (entre ellas, que
necesita decisión humana) y enlace a la demo en directo.

En la diapositiva 2 se recorre un caso real, el mismo del vídeo de la demo (BEC: cambio de IBAN tras AiTM). Se recorren
las 7 etapas sobre un recorrido de nodos con el color de quién decide (mismo código que el dashboard). Cada etapa
tiene su propia vista: la alerta y sus entidades, el contexto por fuente, la reputación de cada indicador, la ecuación
regla × activo = severidad, el veredicto de la IA con su confianza y sus event_id, el incidente correlacionado y las
acciones con quién debe aprobarlas. «Reproducir triaje» recorre las etapas solo, con el tiempo acumulado real.

Navegación: flechas, espacio, Re Pág/Av Pág, Inicio/Fin o la barra inferior. La URL guarda la diapositiva (`#2`).

## Uso
```bash
cd presentacio
npm install
npm run build        # genera dist/index.html: un único fichero, se abre con doble clic, sin servidor ni red
npm run dev          # para editarla con recarga en caliente
npm test             # tests de la lógica (vitest)
```

## Vídeo de la demo
El vídeo (28 MB) no se versiona. Antes de `npm run build`, descárgalo en `public/demo.mp4` (Vite lo copia junto a
`dist/index.html`; para presentar hay que llevar los dos ficheros juntos):
```bash
curl -L -o public/demo.mp4 "https://drive.usercontent.google.com/download?id=1BgI5sqKoFhDQWTVQGeqrcEWuOSDYHbWw&export=download&confirm=t"
```
Si falta, la diapositiva muestra un botón al vídeo en Google Drive (`DEMO_VIDEO` en `src/config/constants.js`).

## Datos
`src/data/casos.json` sale de las trazas y tickets reales de `output/` (que no se versionan):
```bash
python -m soc.pipeline --ids ALR-20261008-011789 --live    # o triarlo desde el dashboard
python presentacio/scripts/export_data.py
```
El script no copia los textos que escribe el atacante (cuerpos de correo, prompts): de esos casos se enseña lo que
concluyó nuestro sistema. Las cifras de las diapositivas están en `src/config/constants.js`, con su fuente.

## Estructura
- `src/components/base`: piezas mínimas (diapositiva, etiqueta de actor, severidad, chip, botón).
- `src/components/shared`: bloques compuestos (explorador del pipeline, vista de cada etapa, navegación).
- `src/pages/slides.jsx`: las diapositivas, que solo componen lo anterior.
- `src/utils`, `src/hooks`, `src/config`: lógica pura con tests, hooks y constantes.

Sin librerías de animación: las transiciones son CSS y respetan `prefers-reduced-motion`.
