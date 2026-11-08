# Presentación interactiva del pipeline

Web de presentación para la defensa: explica cómo funciona nuestro agente N1 paso a paso, con **ejecuciones reales**
del pipeline (no con datos inventados). Es el apoyo del punto «hasta qué nivel habéis llegado y cómo lo habéis
construido»; la demo en directo de las 10 alertas se hace en el dashboard.

## Diapositivas
1. Portada · 2. El problema · 3. Quién decide qué (Política / IA / Persona) · **4. El pipeline interactivo** ·
5. Seguridad (inyección de prompt) · 6. Resultados medidos · 7. Niveles del reto · 8. Lo que no resolvemos ·
9. Enlace a la demo en directo.

En la diapositiva 4 se elige uno de tres casos reales (ataque, falso positivo y phishing con inyección) y se recorren
las 7 etapas: qué hace cada una, quién decide (mismo código de colores que el dashboard), las consultas reales que hizo
con su tiempo (botón «Reproducir consultas») y lo que produjo: la matriz de severidad, el veredicto con sus event_id,
las acciones y quién debe aprobarlas.

Navegación: flechas, espacio, Re Pág/Av Pág, Inicio/Fin o la barra inferior. La URL guarda la diapositiva (`#4`).

## Uso
```bash
cd presentacio
npm install
npm run build        # genera dist/index.html: un único fichero, se abre con doble clic, sin servidor ni red
npm run dev          # para editarla con recarga en caliente
npm test             # tests de la lógica (vitest)
```

## Datos
`src/data/casos.json` sale de las trazas y tickets reales de `output/` (que no se versionan):
```bash
python -m soc.pipeline --ids ALR-20261006-011825,ALR-20261020-005954,ALR-20261020-011912 --live
python presentacio/scripts/export_data.py
```
El script no copia los textos que escribe el atacante (cuerpos de correo, prompts): de esos casos se enseña lo que
concluyó nuestro sistema. Las cifras de las diapositivas están en `src/config/constants.js`, con su fuente.

## Estructura
- `src/components/base`: piezas mínimas (diapositiva, etiqueta de actor, severidad, botón, panel).
- `src/components/shared`: bloques compuestos (explorador del pipeline, traza, navegación).
- `src/components/reactbits`: componentes de [React Bits](https://reactbits.dev) copiados tal cual (BlurText,
  CountUp, DecryptedText, SpotlightCard; licencia MIT + Commons Clause en `LICENSE.md`).
- `src/pages/slides.jsx`: las diapositivas, que solo componen lo anterior.
- `src/utils`, `src/hooks`, `src/config`: lógica pura con tests, hooks y constantes.
