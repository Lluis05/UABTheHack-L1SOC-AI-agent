# 09 · Hallazgos sobre el dataset (documento vivo)

Añadid aquí todo lo que descubráis. Formato: **fecha/hora, autor y hallazgo**, con IDs de alerta o evento como prueba.

## Zona horaria
- (Lluis, 12:45) Los logs y alertas están en **UTC**, pero el calendario de cambios **parece estar en hora local**.
  Ejemplo: SCCM "08:00-10:00" y la alerta ALR-20261005-000301 a las 07:56Z, que son las 09:56 en Barcelona (dentro de la ventana).
  España pasa de UTC+2 a UTC+1 el 25/10/2026. **Hay que confirmarlo** antes de basar decisiones en ventanas horarias.

## Patrones de falsos positivos o benignos
- UC-EDR-002: padre `CcmExec.exe`, usuario SYSTEM, `decoded_preview` con inventario (`Win32_Product` … `C:\Windows\CCM\Inventory`), que encaja con CHG-2026-1031.
  Ojo: el cambio dice `svc_sccm`, pero la alerta muestra `SYSTEM` (lo normal en el agente SCCM). Hay que decidir si es
  aceptable y vigilar los EDR-002 con **otro padre** (Office, explorer, wscript…): esos son los sospechosos.
- UC-EML-001: newsletters legítimas reportadas como phishing (p. ej., `news.zalando.example`).

## Incidentes sospechosos (por investigar)
- …

## Prompt injection observada en los datos
- UC-AI-001: hay prompts de clientes que activan el guardarraíl sin ser maliciosos (p. ej., "Ignora lo anterior, me
  equivoqué de pedido"). Es un falso positivo típico de la regla.

## Preguntas a Deloitte
- ¿El calendario de cambios está en hora local o en UTC?
