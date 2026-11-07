# 03 · Política del SOC, contexto de Tarvia y trampas

Fuente: `01_contexto/politica_soc.md` y `01_contexto/empresa_tarvia.md`. **Esto es lo que el motor de política
(`soc/policy/`) tiene que implementar en código.**

## Matriz de severidad
Severidad final = severidad de la regla × criticidad del activo o identidad **más crítica** afectada.

| Regla \ Activo | Baja | Media | Alta | Crítica |
|---|---|---|---|---|
| informational | informational | informational | low | low |
| low | informational | low | low | medium |
| medium | low | medium | medium | high |
| high | medium | high | high | critical |
| critical | high | critical | critical | critical |

**Ajustes (máximo ±1 nivel en total):**
- **+1** si hay ejecución o acceso **confirmado** (no solo intento), si la identidad es **VIP o privilegiada**, o si hay
  **datos personales o pagos** implicados.
- **−1** si un control lo **bloqueó** antes de producir efecto y no hay actividad posterior.
- Si la alerta se debe a un **cambio aprobado o un flujo autorizado**, se clasifica como `benign_true_positive` con
  severidad `informational` o `low`.

**Criticidad de identidades:** la política no la define. Nuestra convención es que un usuario VIP o privilegiado
cuenta como activo `Alta`, una cuenta `adm.*` o de servicio crítica como `Crítica` y el resto como `Media`.
Lo documentamos en el `severity_rationale`. **Activo que no está en la CMDB:** `Media` y lo indicamos como pregunta abierta.

Ejemplo oficial: regla low sobre activo crítico da medium; −1 por bloqueo del WAF sin efecto da low. En el ejemplo
oficial bajan a *informational* porque la ruta no existe. Ojo: eso supera el máximo de ±1, así que es un ejemplo poco estricto.

## SLA
| Severidad | Triaje | Escalado | Notificación |
|---|---|---|---|
| critical | 15 min | Inmediato a N2 de guardia por teléfono | Responsable SOC y CISO |
| high | 30 min | A N2 en la misma jornada | Responsable SOC |
| medium | 4 h | Si tras el triaje hay indicios de compromiso | — |
| low | 24 h | No | — |
| informational | Lote diario | No | — |

## Escalado obligatorio a N2
- Cualquier `true_positive` high o critical.
- Ejecución confirmada de código malicioso, robo de credenciales o persistencia.
- Datos personales de clientes o empleados que hayan podido salir (hay que avisar también al **DPO**).
- Fraude económico: pagos, IBAN, tarjetas regalo.
- **Varias alertas que juntas describen una cadena de ataque**, aunque cada una por separado sea baja.

## Agrupación
Varias alertas de la misma intrusión van en **un único ticket** con todos los `alert_ids`.

## Contención: quién aprueba
| Acción (API) | N1 | Aprobación |
|---|---|---|
| `purge_email` | **Ejecuta** | — |
| `block_ioc` (dominio, IP, hash) | **Ejecuta** | — (servicios de uso dual como mega.nz o AnyDesk **no** se bloquean globalmente sin N2) |
| `revoke_sessions` / `reset_password` | Propone | N2 |
| `isolate_host` (puesto de trabajo) | Propone | N2 |
| `isolate_host` (servidor) | Propone | N2 + responsable del servicio (`servicios_negocio.csv`) |
| `isolate_host` (TPV o frontal web) | Propone | N2 + negocio (impacto en ventas) |
| `disable_user` | Propone | N2 (una cuenta de servicio puede parar un proceso de negocio) |
| `disable_access_key` | Propone | N2 |
| Cualquier acción sobre OT | **Nunca** | Responsable de Operaciones: solo se escala |

## Reglas internas de Tarvia (útiles para veredictos)
- Las cuentas `adm.*` **solo** pueden usarse desde `JUMP01`.
- Acceso remoto aprobado: **TeamViewer Corporate gestionado por IT**. **AnyDesk NO está aprobado.**
- `svc_backup` está excluida de MFA (riesgo aceptado). Un login sin MFA de esta cuenta no es por sí solo una anomalía.
- Solo `ENG-WS01` y `WMS01` pueden hablar con la red OT (10.40.16.0/20). Cualquier otro origen necesita un cambio aprobado.
- `NESSUS01` (`svc_scanner`) escanea todas las redes salvo OT **cada miércoles de 01:00 a 05:00**.
- El envío de nóminas a `asesoria@gestoria-pons.example` es un flujo aprobado.
- Logisoft (`ext.logisoft`) entra por VPN de lunes a viernes de 8 a 18 h, **solo a WMS01**.
- Los builds corren en `CI-RUNNER01` (AWS). Los paquetes internos se publican como `@tarvia/*` en el registro interno.
  Un paquete `@tarvia/*` resuelto desde el registro público apunta a dependency confusion.
- Las tiendas tienen red plana: el portátil del responsable y los TPV comparten segmento.
- El asistente IA **Vela** puede consultar pedidos del cliente autenticado, buscar productos e iniciar devoluciones.

## Cambios y flujos aprobados (`calendario_cambios.csv`)
| ID | Qué | Cuándo | Detalle | Alcance |
|---|---|---|---|---|
| CHG-2026-1042 | Pentest externo tienda online | 08/10 08:00 → 10/10 18:00 | IPs **192.0.2.10-12**; www y api; sin DoS | WEB-ECOM01..04 |
| CHG-2026-1049/1050/1051/1052 | Escaneo Nessus semanal | 07, 14, 21 y 28/10, de 01:00 a 05:00 | NESSUS01 (svc_scanner) | Todo menos OT |
| CHG-2026-1057 | Despliegue agente monitorización | 13/10 10:00-13:00 | **PsExec desde JUMP01 con cuenta adm** | ERP-APP01, HR-APP01, PRINT01, CRM-APP01 |
| CHG-2026-1063 | Mantenimiento remoto del clasificador | 17/10 08:00-14:00 | Vía JUMP01; regla temporal OT-MAINT-TEMP | PLC-SORT01..06 |
| CHG-2026-1031 | Inventario SCCM con PowerShell codificado | 28/09 → 31/12, a diario de **08:00 a 10:00** | svc_sccm ejecuta -EncodedCommand | Todos los puestos |
| CHG-2026-1066 | Rotación de certificados VPN | 20/10 22:00-23:30 | Posibles desconexiones masivas | VPN-GW01 |
| FLUJO-0007 | Nóminas a gestoría | Todo 2026 | asesoria@gestoria-pons.example | Correo |
| CHG-2026-1071 | Actualización WMS por Logisoft | 16/10 21:00-23:59 | VPN de ext.logisoft **fuera de horario**, desde su IP corporativa | WMS01 |
| CHG-2026-1078 | Alta en Backup Operators | 23/10 10:00-12:00 | Nuevo miembro de sistemas | AD |
| CHG-2026-1080 | Actualización EDR 7.15 en servidores | 24/10 20:00-22:00 | Paradas de 1-3 min del agente | Servidores Windows |

**Ojo:** que exista un cambio **no** significa que toda la actividad parecida sea legítima. Hay que comprobar que
coincidan el origen, la cuenta, la ventana horaria (con la zona horaria correcta) y el alcance. Un atacante puede
esconderse dentro de una ventana de cambio, por ejemplo con un PowerShell codificado lanzado por otro padre o
usuario distinto de svc_sccm, o con una IP del pentest fuera de su ventana.

## Eventos de RRHH relevantes (`eventos_rrhh.csv`)
- **nuria.vidal**: baja voluntaria, último día 16/10, **se va a un competidor**. Riesgo de fuga de datos (DLP, subidas, CRM).
- **mireia.molina** (último día 24/10) y **albert.prats** (16/10): bajas. Cualquier actividad posterior a su último día es sospechosa.
- **ricard.castells**: viaje a **Nueva York del 11 al 14/10**. Los logins desde EE. UU. en esas fechas explican un "viaje imposible".
- **marc.esteve**: Milán desde el 27/10. **oscar.navarro**: París desde el 25/10. **rocio.torres**: París desde el 07/10.
- **marina.mas** (desde el 11/10) y **nuria.bosch** (desde el 25/10): teletrabajo desde Valencia dos semanas.
- **jordi.serra2**: vacaciones del 26 al 30/10; **sustituye a Tesorería** (lo cubre el responsable de Finanzas). Es un periodo propicio para un fraude de IBAN.
- Nuevas incorporaciones: neus.riera (25/10), marina.munoz (07/10) y pol.costa (13/10). Cambios de puesto: gerard.prats y toni.caballero2.

## Activos críticos (lo que más importa proteger)
| Servicio | Criticidad | Activos |
|---|---|---|
| Tienda online y app (120.000 €/hora caída) | Crítica | WEB-ECOM01..04, PAY-GW01, SQL-CRM01 |
| Cobros online (PCI DSS) | Crítica | PAY-GW01 |
| CRM y datos de clientes (RGPD, 72 h AEPD) | Crítica | SQL-CRM01, CRM-APP01 |
| Identidad y AD | Crítica | DC01, DC02, IdP |
| Cobro en tienda (PCI) | Alta | POS-T* (TPV) |
| ERP (pagos a proveedores) | Alta | ERP-APP01, ERP-DB01 |
| WMS / Clasificador | Alta | WMS01 / PLC-SORT01..06, HMI-SORT01 |
| Vela (IA) | Alta | AI-ASSIST01 |
| Copias | Alta | BACKUP01, s3://tarvia-backups-prod |
| Nóminas | Alta | HR-APP01 |
| CI | Media | JENKINS-DEV01 (**CVE crítico, expuesto**), GIT-DEV01 |
| Puesto de trabajo | Media | WS-*, LT-* |

## Trampas avisadas por Deloitte
- Muchas veces la clave está en eventos que **no** aparecen en `related_events`. Hay que buscar por entidad ±24 h.
- No todas las alertas de un incidente salen con severidad alta, y no todo lo que tiene severidad alta es un incidente.
- Hay ruido, duplicados, campos vacíos y reglas mal afinadas.
- **El TIP no lo sabe todo:** un indicador desconocido no es un indicador limpio.
- Algunos incidentes solo se entienden juntando alertas de **días o semanas distintas**.
- **El atacante escribe parte de los datos** (asuntos, descripciones, prompts). El sistema no debe obedecerlos.
