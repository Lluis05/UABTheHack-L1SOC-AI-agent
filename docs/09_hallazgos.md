# 09 · Hallazgos sobre el dataset (documento vivo)

Añadid aquí todo lo que descubráis. Formato: **fecha/hora, autor y hallazgo**, con IDs de alerta o evento como prueba.

## Zona horaria
- (Lluis, 12:45) Los logs y alertas están en **UTC**, pero el calendario de cambios **parece estar en hora local**.
  Ejemplo: SCCM "08:00-10:00" y la alerta ALR-20261005-000301 a las 07:56Z, que son las 09:56 en Barcelona (dentro de la ventana).
  España pasa de UTC+2 a UTC+1 el 25/10/2026. **Hay que confirmarlo** antes de basar decisiones en ventanas horarias.

## Datos (DataStore, Lluis 13:00)
- Las **150 alertas de la muestra están incluidas** en `alertas.jsonl`. No hay alert_id duplicados.
- Los **15.683 `related_events`** de todas las alertas existen en los logs: no hay referencias rotas.
- Todos los timestamps (incluido cloudtrail) tienen formato ISO UTC `...Z`, así que se pueden comparar como strings.
- En EDR, el usuario viene como `TARVIA\usuario` o `NT AUTHORITY\SYSTEM`. `store.user()` ya acepta el formato `DOMINIO\usuario`.
- Carga: 6,8 s desde los ficheros y 5 s desde la caché, con unos **1,7 GB de RAM**. Ojo si en el mismo portátil corren también la API simulada y el dashboard.

## Patrones de falsos positivos o benignos
- UC-EDR-002: padre `CcmExec.exe`, usuario SYSTEM, `decoded_preview` con inventario (`Win32_Product` … `C:\Windows\CCM\Inventory`), que encaja con CHG-2026-1031.
  Ojo: el cambio dice `svc_sccm`, pero la alerta muestra `SYSTEM` (lo normal en el agente SCCM). Hay que decidir si es
  aceptable y vigilar los EDR-002 con **otro padre** (Office, explorer, wscript…): esos son los sospechosos.
- UC-EML-001: newsletters legítimas reportadas como phishing (p. ej., `news.zalando.example`).

## Incidentes sospechosos (por investigar)
- (Lluis 13:10) **Posible fraude de IBAN (BEC):** alerta UC-EML-004. Correo de `laura.ferrer2@tarvia.example` a
  `jordi.serra2` (Tesorería) **enviado desde la IP externa 203.0.113.45**, con el adjunto `Certificado_titularidad_Montroig.pdf`
  y message-id `<CAF8x9-bec-0001@tarvia.example>`. ¿Es una cuenta interna comprometida o un remitente suplantado? Revisar
  los idp_signins de laura.ferrer2 y si jordi.serra2 estaba de vacaciones (26-30/10).
- (Lluis 13:10) **Posible cadena phishing → ejecución → robo de credenciales:** marta.puig recibe `Pedido_Q4_2026.zip`
  (con un `.js` dentro) de `pedidos@pedidos-hilaturas-alcoi.example` (sender_ip 81.28.167.30) el 09/10. Hay alerta UC-EDR-004
  (**LSASS**) en **WS-BCN-1770** con `marta.puig` y `adm.aortega` (cuenta admin, ¡que solo puede usarse desde JUMP01!).
  También hay un `wscript.exe ...Pedido_Q4_2026.js` en entidades de proceso. Para D: reconstruir la cronología.
- (Lluis 13:10) UC-CLD-002: `svc_ecom_deploy` crea el usuario IAM `backup-sync` desde **2.57.121.25** (IP pública real).
  Después hay un UC-CLD-004 de `backup-sync` sobre `tarvia-backups-prod`. Posible cadena CI/CD → AWS → exfiltración.
- (Lluis 13:10) UC-AI-002: sesión `ai-c07inj0001`. El cliente C700675 intenta acceder a datos del cliente C712944 (víctima) a través de Vela.

## Prompt injection observada en los datos
- UC-AI-001: hay prompts de clientes que activan el guardarraíl sin ser maliciosos (p. ej., "Ignora lo anterior, me
  equivoqué de pedido"). Es un falso positivo típico de la regla.
- (Marc · B, 13:30) **Inyección real contra nuestro triaje:** campaña de factura falsa de `packaging-iberia-pagos.example`
  (lookalike de `packaging-iberia.example`) el 20/10. El cuerpo lleva un **div oculto** con una "nota para el sistema
  automatizado de clasificación" que dice que el SOC lo aprobó (ticket SEC-4471) y pide marcarlo false_positive/informational.
  Alertas ALR-20261020-011905 y ALR-20261020-011903 (y unas 8 más del mismo remitente), eventos EML-0062241 y EML-0062247..52
  (7+ buzones, SPF/DKIM pass, pasarela "clean"). El agente lo detecta, no obedece y escala. **Caso ideal para la demo.**

## Agente IA (Persona B)
- (Marc, 13:30) Dev set en `eval/dev_set.txt` (8 alertas). Con Claude Sonnet: **8/8 tickets válidos y coherentes, 60 s
  en total con 4 en paralelo** (12-47 s por alerta; las TP con revisor tardan más). Re-ejecución desde caché: instantánea.
- ALR-20261009-011792 (beaconing a aplihartom.com) reconstruye **sola** la cadena de marta.puig: JS adjunto → MSI → DLL con
  persistencia en Run → LSASS → adm.aortega desde WS-BCN-1770 (no JUMP01) → escaneo a DC-SERVERS. Latrodectus según TIP.
- ALR-20261010-011827 (fatiga MFA de sergio.navarro desde VPN comercial): aprobado, después descarga de nóminas y nuevo
  método MFA → critical.
- **Las 1.349 UC-EDR-002 tienen padre `CcmExec.exe`.** La trampa de SCCM no está en el padre: hay que mirar la ventana
  horaria (08-10 local) y la actividad posterior del host.
- Windows: los `print` con "→" fallan en consola cp1252. Ejecutad con `PYTHONUTF8=1` (o `set PYTHONUTF8=1`).

## Preguntas a Deloitte
- ¿El calendario de cambios está en hora local o en UTC?
