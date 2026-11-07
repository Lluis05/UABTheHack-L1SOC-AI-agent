# 02 · El dataset

Repo: https://github.com/dttdfr/DTT-UAB-The-Hack (297 MB). Lo clonamos **fuera** de nuestro repo y apuntamos con
`DATASET_DIR` en `.env`.

- **Periodo:** 2026-10-04 → 2026-11-01. **Timestamps en UTC.** España está en UTC+2 hasta el 25/10 y en UTC+1 después.
  Ojo: el calendario de cambios **parece estar en hora local** (ver [09_hallazgos.md](09_hallazgos.md)).
- **11.061 alertas** del SIEM, todas con `status: new`, y **814.471 eventos** de log.
- Todo es sintético, salvo una parte de los IOCs maliciosos, que son reales (ThreatFox, MalwareBazaar, Tor, C2IntelFeeds, IPsum).
  El resto usa rangos de documentación (192.0.2.0/24, 198.18.0.0/15, 203.0.113.0/24) y dominios `.example`.

## Estructura
```
01_contexto/      empresa_tarvia.md, politica_soc.md, catalogo_casos_de_uso.csv (44 reglas),
                  runbooks/RB-01..RB-10.md, ticket_salida.schema.json, informe_incidente.schema.json, ticket_ejemplo.json
02_inventario/    activos.csv (1185), usuarios.csv (1224), servicios_negocio.csv, zonas_red.csv, tiendas.csv,
                  vulnerabilidades.csv, eventos_rrhh.csv, calendario_cambios.csv
03_alertas/       alertas.jsonl (11.061), alertas_muestra_desarrollo.jsonl (150, para desarrollar)
04_logs/          18 fuentes (abajo)
05_inteligencia/  ti_feed.jsonl (TIP), geoip_asn.csv (86.981 IPs), sandbox_informes.jsonl
06_herramientas/  mock_soc_api.py (FastAPI), refresh_iocs.py (solo organizadores)
```

## Formato de una alerta
```json
{
  "alert_id": "ALR-20261005-000301",
  "created_at": "2026-10-05T07:56:30.000Z",
  "source_product": "EDR",
  "rule_id": "UC-EDR-002",
  "rule_name": "PowerShell con comando codificado",
  "severity": "medium",
  "status": "new",
  "mitre": {"tactic": "Execution", "technique_id": "T1059.001", "technique": "PowerShell"},
  "description": "Ejecución de PowerShell con -EncodedCommand.",
  "entities": {"hosts": [{"hostname": "WS-BCN-1174", "ip": "10.10.1.185"}],
               "processes": [{"name": "powershell.exe", "parent": "CcmExec.exe"}]},
  "evidence": {"parent": "CcmExec.exe (agente SCCM)", "user": "SYSTEM", "decoded_preview": "..."},
  "related_events": ["EDR-0005329"],
  "runbook": "RB-02"
}
```
- **`entities`** puede tener: `ips` (4902), `users` (4297), `hosts` (3818), `domains` (3759), `urls` (3414), `processes` (1884),
  `customers` (428), `files` (425), `cloud` (53) y `ai_session` (3). La estructura interna varía según el tipo:
  hay que normalizarla.
- **`evidence`** es libre y depende de la regla. **Puede contener texto del atacante.**
- **`related_events`**: IDs de eventos de log. El prefijo indica la fuente (tabla abajo).
- La **severidad de la regla NO es la final**. La final se calcula con la matriz (ver [03](03_politica_y_contexto.md)).

## Alertas por regla (dataset completo)
| Regla | Nº | Regla | Nº | Regla | Nº |
|---|---|---|---|---|---|
| UC-WEB-001 inyección web | 3406 | UC-NET-006 túnel DNS | 91 | UC-EDR-011 manipulación EDR | 7 |
| UC-EML-001 phishing reportado | 2295 | UC-WEB-002 credential stuffing | 77 | UC-NET-004 mov. lateral | 5 |
| UC-EDR-002 PowerShell codificado | 1349 | UC-IDP-002 password spraying | 62 | UC-EML-003 clic phishing | 4 |
| UC-IDP-001 viaje imposible | 901 | UC-DLP-001 subida masiva | 59 | UC-DLP-002, UC-EDR-012 | 3 c/u |
| UC-NET-001 beaconing | 746 | UC-CLD-003 bucket público | 50 | UC-NET-002, IDP-004/006/008 | 2 c/u |
| UC-NET-005 DGA | 561 | UC-NET-003 escaneo interno | 20 | **1 sola alerta (¡ojo, suelen ser las importantes!):** |
| UC-EDR-001 hijo de Office | 532 | UC-WEB-003 ATO cliente | 12 | EDR-004 LSASS, EDR-005 AnyDesk, EDR-006 minería, EDR-007 shadow copies, EDR-008 recon, |
| UC-AI-001 prompt injection | 415 | UC-DEV-001 supply chain | 11 | IDP-003 MFA fatigue, IDP-005 regla buzón, EML-002, EML-004 IBAN, |
| UC-EDR-003 malware AV | 411 | UC-OT-001 / UC-VPN-001 | 10 c/u | AI-002, CLD-001, CLD-002, CLD-004 |

Muestra de desarrollo (150): WEB-001 36, EML-001 34, EDR-002 19, IDP-001 11, NET-005 9, NET-001 8, AI-001 6, …
Severidad de regla en la muestra: low 82, medium 52, high 16.

## Logs (`04_logs/`)
| Fuente | Eventos | Prefijo ID | Campos |
|---|---|---|---|
| `proxy.csv` | 194.258 | PRX- | timestamp, src_ip, hostname, user, method, url, domain, dst_ip, status, bytes_out, bytes_in, category, action, user_agent |
| `dns.csv` | 178.221 | DNS- | timestamp, src_ip, hostname, query, qtype, response, rcode |
| `edr_events.jsonl` | 112.492 | EDR- | timestamp, event_type, hostname, user, process_name, process_path, command_line, parent_name, pid, parent_pid, sha256, signer, integrity, details |
| `idp_signins.jsonl` | 76.713 | SIGN- | timestamp, user_upn, app, result, failure_reason, mfa_method, mfa_result, src_ip, country, city, asn, user_agent, device_id, device_compliant, session_id, risk_level, conditional_access |
| `waf.jsonl` | 71.421 | WAF- | timestamp, src_ip, country, method, host, uri, status, rule_id, rule_msg, action, user_agent, bytes |
| `email.jsonl` | 56.797 | EML- | timestamp, direction, message_id, sender, recipients, subject, attachments, urls, verdict, action, spf, dkim, dmarc, sender_ip |
| `ecom_auth.jsonl` | 44.064 | ECA- | timestamp, customer_id, email, src_ip, result, failure_reason, user_agent, device_fp, captcha |
| `firewall.csv` | 24.648 | FW- | timestamp, src_ip, src_port, dst_ip, dst_port, proto, action, rule, bytes, zone_src, zone_dst |
| `email_clicks.jsonl` | 16.249 | CLK- | timestamp, user, url, message_id, action, verdict_at_click, src_ip |
| `vpn.jsonl` | 9.821 | VPN- | timestamp, user, src_ip, assigned_ip, action, country, bytes, mfa_result |
| `ai_gateway.jsonl` | 8.817 | AIG- | timestamp, session_id, customer_id, authenticated, src_ip, prompt, response_summary, tool_calls, guardrail, model, tokens_in, tokens_out |
| `ecom_account.jsonl` | 7.661 | ECO- | timestamp, customer_id, event, details, src_ip, amount |
| `cloudtrail.jsonl` | 6.496 | CT- | **eventTime**, eventName, eventSource, awsRegion, sourceIPAddress, userAgent, userIdentity{type,userName,accessKeyId}, requestParameters, errorCode |
| `sql_audit.jsonl` | 3.924 | SQL- | timestamp, user, client_host, database, statement_type, object, rows_returned |
| `dlp.jsonl` | 1.042 | DLP- | timestamp, user, hostname, channel, destination, file_name, file_size, policy, matches, action |
| `idp_audit.jsonl` | 762 | AUD- | timestamp, actor_upn, operation, target, src_ip, details |
| `cicd_builds.jsonl` | 559 | CI- | timestamp, pipeline, build_id, runner, step, status, details |
| `ad_events.jsonl` | 526 | ADE- | timestamp, dc, event_code, event, subject, target, src_host, details |

Todos los eventos tienen `event_id`. Ojo: `cloudtrail` usa `eventTime`, no `timestamp`.

## Inventario
- **activos.csv:** asset_id, hostname, ip, type, os, **criticality** (Baja 1 / Media 941 / Alta 233 / Crítica 10), **zone**,
  location, business_service, owner_upn, internet_facing, edr_installed, description.
- **usuarios.csv:** user_id, username, upn, display_name, department, title, location, manager_upn,
  **account_type** (user 1208 / service 8 / admin 7 / external 1), **privileged** (9), **vip** (9), mfa_method, status,
  created, workstation, notes. Ojo: hay usuarios con sufijo numérico (`jordi.serra2`), así que no hay que confundirlos.
- **servicios_negocio.csv:** servicio, criticidad, impacto, activos (con rangos tipo `WEB-ECOM01..04`, `POS-T*`), responsable.
- **zonas_red.csv:** HQ-USERS 10.10/16, MAD-USERS 10.11/16, DC-SERVERS 10.20/16, STORES 10.30/16, LOGISTICS-IT 10.40.0/20,
  **LOGISTICS-OT 10.40.16/20**, DMZ 10.50/16, DEV 10.60/16, VPN-POOL 10.99/16, AWS-PROD 172.16/16.
- **vulnerabilidades.csv** (46): hostname, id (CVE), producto, severidad_cvss, estado, detectada, notas.
  Ej.: JENKINS-DEV01 con CVE-2024-23897 9.8, expuesto a Internet por error.
- **eventos_rrhh.csv** (17): bajas, viajes, vacaciones, altas, teletrabajo. Ver [03](03_politica_y_contexto.md).
- **calendario_cambios.csv** (13): cambios y flujos aprobados. Ver [03](03_politica_y_contexto.md).

## Inteligencia
- **ti_feed.jsonl:** indicator_type, value, reputation, confidence, malware_family, tags, first_seen, last_seen, source, note.
  **"El TIP no lo sabe todo. Un indicador desconocido no es un indicador limpio."**
- **geoip_asn.csv:** ip, country, city, asn, as_org, is_tor, is_vpn_provider, is_hosting, is_residential_proxy.
- **sandbox_informes.jsonl:** sha256, md5, file_name, verdict, score, malware_family, behaviors, network, mitre, dropped_files, analysis_env, analyzed_at, note.

## API simulada (`06_herramientas/mock_soc_api.py`)
```bash
cd $DATASET_DIR/06_herramientas && pip install -r requirements.txt && uvicorn mock_soc_api:app --port 8000
```
| Endpoint | Uso |
|---|---|
| `GET /alerts?status=new&limit=50&rule_id=&desde=&hasta=` | Cola |
| `GET /alerts/{id}` | Detalle |
| `GET /assets/{hostname_o_ip}` | CMDB + vulnerabilidades |
| `GET /users/{upn_o_username}` | Directorio + eventos RRHH |
| `GET /logs/{fuente}?q=&desde=&hasta=&limit=` | Búsqueda de texto en logs (**lenta**: recorre todos los eventos uno a uno en cada consulta) |
| `GET /intel/{indicador}` | TIP + GeoIP |
| `GET /sandbox/{sha256}` | Sandbox |
| `GET /changes?q=` | Cambios aprobados |
| `POST /approvals` `{action,target,approver,reason}` | Devuelve `approval_token` (simula la aprobación humana) |
| `POST /containment/{accion}` `{target,justification,approval_token,ticket_id}` | Contención simulada |
| `GET /containment/log` | Registro |

Acciones: `isolate_host`, `disable_user`, `revoke_sessions`, `reset_password`, `block_ioc`*, `purge_email`*, `disable_access_key`.
(*) no requieren token. La API rechaza `isolate_host` sobre la zona OT.

**Decisión de equipo:** para *leer* usamos nuestra propia capa de datos indexada (`soc/data/`), mucho más rápida.
Para la **contención** usamos la API simulada, porque es lo que piden y deja registro.
