# 08 · Demo y pitch

## Qué hay que enseñar (requisitos de Deloitte)
1. **La cola de alertas.**
2. **Qué consulta la IA**: la traza de lookups (CMDB, directorio, TIP, logs ±24 h, cambios).
3. **En qué se basa para decidir**: evidencias con `event_id`, reglas de política aplicadas y matriz de severidad.
4. **Qué propone**: veredicto, severidad, acciones.
5. **Dónde interviene la persona**: aprobación de la contención y revisión de lo escalado.
6. **Las 10 alertas comunes en directo, elegidas al azar.** Se tría en el momento, nada precalculado.
   Se pegan o suben en el dashboard (o se lanza `--ids`/`--file`) y se ve cómo avanza cada una en tiempo real.
   **Ensayadlo con `--random 10` varias veces**: así nos aseguramos de que no hay ninguna regla o tipo de alerta
   que rompa el sistema. Hay 41 reglas distintas en el dataset y las raras (una sola alerta) también pueden salir.

### Checklist antes de la defensa
- [ ] DataStore precargado: el dashboard abierto y caliente **antes** de empezar.
- [ ] API simulada levantada (`uvicorn ... --port 8000`).
- [ ] `claude` logueado y con cuota disponible. Gemini probado.
- [ ] Simulacro `--random 10 --live` hecho en el mismo portátil y la misma red, en menos de 2 minutos.
- [ ] Modo live **sin caché LLM** (es el comportamiento por defecto de `--live` y del dashboard): la IA razona cada alerta en directo. No pasar `--cache`.
- [ ] Vídeo de respaldo grabado por si falla la red.
7. Hasta qué nivel hemos llegado y cómo lo hemos construido.
8. **Una página para el comité de dirección de Tarvia.**

## Guion de la demo (unos 7 minutos)
1. **El problema (30 s):** 4.000 alertas al día, 15 min por alerta, nadie de noche. Ahora el sistema tría en segundos.
2. **La cola (1 min):** las 11.061 alertas procesadas, con el desglose de cuántas cerró la política sola, cuántas
   analizó la IA y cuántas se escalaron.
3. **Un falso positivo bien argumentado (1 min):** PowerShell codificado de SCCM, cerrado con la referencia
   CHG-2026-1031 y la comprobación de padre, usuario y horario.
4. **Un benigno autorizado (30 s):** WAF disparado por el pentest (CHG-2026-1042, IPs 192.0.2.10-12).
5. **Un incidente real (2 min):** varias alertas de días distintos agrupadas en un incidente, con la cadena de
   ataque, la severidad calculada con la matriz y la escalada a N2.
6. **Intervención humana (1 min):** aprobar `revoke_sessions` y ver cómo se registra en la API con el token de aprobación.
7. **Prompt injection (30 s):** una alerta con instrucciones del atacante que se detectan y no se obedecen.
8. **Honestidad (30 s):** lo que no resolvemos (ver abajo).

## Mensajes clave
- **"La IA investiga, la política decide la severidad, la persona aprueba."** Cada campo indica quién lo decidió.
- **Coste:** el LLM solo se usa donde aporta criterio. Lo demás es determinista, trazable y gratis.
- **Seguro por diseño:** el LLM no tiene herramientas ni acceso a la contención, y los datos del atacante se tratan como datos.
- **Métricas:** de unos 15 min por alerta a unos X s; Y % de ruido cerrado con justificación; Z incidentes encontrados.

## One-pager para el comité de dirección (lenguaje de negocio, sin jerga)
- Qué hemos construido, en una frase.
- Impacto: horas de analista ahorradas al mes y cobertura 24/7.
- Riesgos detectados en el dataset, en términos de negocio (fraude IBAN, datos de clientes, tienda online...).
- Qué decide la máquina y qué decide la persona.
- Limitaciones y próximos pasos (piloto, más fuentes, afinar reglas del SIEM).

## Lo que no resolvemos (rellenar con honestidad durante la noche)
- …
