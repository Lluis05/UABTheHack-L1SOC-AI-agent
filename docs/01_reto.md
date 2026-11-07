# 01 · El reto de Deloitte

## Objetivo
Construir con IA el **triaje de nivel 1 (N1)** del SOC de **Tarvia Group**, un retailer ficticio de moda y hogar
que prepara el Black Friday. Para cada alerta, el sistema debe investigarla con los datos disponibles y dejar al
analista humano **una conclusión lista para decidir**. Arquitectura, modelos y tecnología son libres.

La CISO quiere un piloto de "agentes que triajen cada alerta las 24 horas y dejen al analista solo la decisión".
Hoy un N1 tarda unos **15 minutos por alerta** (SIEM 1' → CMDB/directorio 3' → OSINT 4' → logs 5' → decidir 2').
El SOC solo trabaja de 8 a 20 h entre semana. Por la noche y en fin de semana nadie mira la consola.

## Los 4 niveles (todos empiezan por el 1)
| Nivel | Qué añade |
|---|---|
| **1 · Triaje básico** | Por alerta: entender, enriquecer con contexto e inteligencia, veredicto, severidad y recomendación (cerrar o escalar) |
| **2 · Triaje con criterio** | Correlación: agrupar alertas del mismo ataque, aplicar la matriz de severidad con la criticidad real del activo y descartar con argumentos la actividad autorizada |
| **3 · Investigación** | Para lo escalado: reconstruir la cadena de ataque (aunque dure días): origen, alcance, relación con otros incidentes |
| **4 · Respuesta** | Proponer la contención y ejecutarla en la API simulada, **siempre con aprobación humana** |

## Los 7 pasos del triaje (diapositiva 5 y `politica_soc.md`)
1. **Entender:** qué detectó la regla y sobre qué entidades.
2. **Contexto:** criticidad del activo, rol del usuario, cambios aprobados, viajes.
3. **Enriquecer:** TIP, OSINT, GeoIP y sandbox para cada indicador.
4. **Correlar:** otras alertas y logs de las mismas entidades (±24 h).
5. **Decidir:** veredicto y nivel de confianza.
6. **Priorizar:** severidad de la regla × criticidad del activo.
7. **Actuar:** ticket, cierre o escalado y contención propuesta.

## Veredictos
- `true_positive`: es malicioso (p. ej., un adjunto JS ejecutado que abre un canal con el atacante).
- `benign_true_positive`: la regla acierta, pero la actividad está autorizada (p. ej., el pentest contratado dispara el WAF).
- `false_positive`: la regla se equivoca (p. ej., el inventario de software usa PowerShell codificado).
- `needs_more_info`: solo existe en el esquema del ticket. Lo usamos cuando no hay datos suficientes y lo decimos con honestidad.

## Salida
Ticket JSON según `01_contexto/ticket_salida.schema.json` del dataset (resumido en [04_arquitectura.md](04_arquitectura.md)).
Hay un ejemplo en `01_contexto/ticket_ejemplo.json`. Para el nivel 3 está `informe_incidente.schema.json`.
Ambos formatos son **opcionales**, pero conviene seguirlos.

## Qué se presenta (domingo, en directo)
- **Demo visual obligatoria:** la cola de alertas, qué consulta la IA, en qué se basa para decidir, qué propone y
  **dónde interviene la persona**. Una interfaz, no solo consola.
- **Las mismas 10 alertas para todos los equipos**, triadas en directo. Nos las dan el último día, así que el sistema
  debe procesar **alertas nuevas que no ha visto**, rápido y sin intervención manual.
- Hasta qué nivel hemos llegado y cómo lo hemos construido.
- **Una página para el comité de dirección de Tarvia.**

## Lo que más valoran (literal)
1. Que el triaje sea **correcto y esté bien argumentado**.
2. Que **funcione de verdad** sobre los datos.
3. **Papeles claros** para la IA y para la persona.
4. **Honestidad** con lo que no resuelve.

> "Un nivel 1 sólido, que funciona y se explica bien, vale más que llegar al nivel 4 sin poder demostrarlo."

## Reglas
- Nada de malware real ni de sistemas reales.
- Contención solo contra la API simulada y con aprobación humana.
- Los IOCs reales del dataset solo se consultan en servicios de reputación: no se visitan, no se descarga nada y no se escanean.
