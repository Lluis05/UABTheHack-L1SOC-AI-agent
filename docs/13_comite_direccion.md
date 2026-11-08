# Tarvia · Un analista de seguridad que no duerme

**Para:** Comité de Dirección de Tarvia Group · **De:** equipo del piloto SOC N1 con IA · **Noviembre 2026**

## Qué hemos construido
Un **analista virtual de primer nivel** que revisa cada alerta de seguridad en segundos, de día y de noche, y deja a
nuestro equipo **solo la decisión**. Investiga como lo haría una persona, pero **ninguna acción sobre nuestros sistemas
se ejecuta sin la aprobación de una persona**.

## Por qué importa
Hoy recibimos unas **4.000 alertas al día** y revisar cada una a mano lleva unos **15 minutos**. El equipo trabaja de
8 a 20 h entre semana: **de noche y en fin de semana nadie mira la consola**, justo cuando más ataques empiezan.

| Lo medimos sobre un mes real de alertas (5 oct – 1 nov) | Resultado |
|---|---|
| Alertas del mes que, a mano, habrían costado **≈ 2.765 horas** de analista | revisadas todas |
| Alertas cerradas solas, **con su justificación escrita** (ruido, pruebas autorizadas, inventarios…) | **90 %** |
| Tiempo para revisar 10 alertas nuevas en directo | **73 segundos** (a mano: unas 2,5 horas) |
| Ataques reales cerrados por error como inofensivos | **0** |
| Ataques reales encontrados y reconstruidos de principio a fin | **12 de 12** |

## Qué ha encontrado en nuestros sistemas
Durante la preparación del Black Friday hubo **12 ataques reales** escondidos entre más de 11.000 alertas. Los más graves,
por lo que protegen:

- **La continuidad del negocio.** Un correo de phishing acabó con el atacante **controlando todo el dominio
  corporativo** y desactivando la protección de un servidor: el paso previo típico a un **ransomware**. A las puertas
  de la campaña, cada hora de tienda online caída cuesta **≈ 120.000 €**.
- **Los pagos.** Un intento de **fraude por cambio de IBAN** de **148.320 €** a un proveedor, y **TPV de la tienda T07
  infectados** para robar datos de tarjetas (obligaciones PCI DSS).
- **Los datos de clientes.** **112 GB de copias de seguridad del CRM** sacados de la nube, **41.200 emails de clientes**
  enviados por una empleada a su correo personal y **12 cuentas de clientes** tomadas para comprar tarjetas regalo.
  Una brecha así se notifica a la AEPD y a la CNPD en **72 horas**.
- **Martorell.** Las credenciales de un **proveedor (Logisoft)** usadas de madrugada para llegar al **servidor del
  almacén** que organiza la salida de pedidos.

## Quién decide qué

| La máquina | La persona |
|---|---|
| Investiga cada alerta: consulta inventario, usuarios, cambios aprobados, reputación y registros. | Aprueba o rechaza cada acción de contención (aislar un equipo, bloquear una cuenta…). |
| Calcula la gravedad con **reglas fijas de nuestra política**, no a criterio de la IA. | Revisa lo escalado y puede corregir cualquier decisión. |
| Propone qué hacer y **quién debe aprobarlo**, según nuestra política. | Toma las decisiones con impacto en el negocio. |

Cada conclusión cita la prueba en la que se basa, y el sistema detecta y **no obedece** los textos que los atacantes
esconden para engañar a la IA (6 de 6 intentos detectados).

## Límites, con honestidad
- Sin la IA disponible, las reglas resuelven 9 de cada 10 alertas; el resto **no se cierra**: queda para una persona.
- Algunas listas (servicios de confianza, infraestructura conocida) son fijas y hay que mantenerlas.
- Los resultados se han medido sobre nuestros datos y nuestra propia revisión; falta validarlos en producción.

## Lo que proponemos
1. **Piloto de 3 meses en paralelo** con el equipo actual, empezando por noches y fines de semana.
2. **Conectar más fuentes** y afinar las reglas de detección que hoy generan más ruido.
3. Medir cada mes: horas ahorradas, tiempo hasta detectar un ataque y errores corregidos por el equipo.
