# Especificación — Combustible Waylet (Repsol)

**ID**: 004-waylet · **Estado**: implementado

## 1. Resumen

Lectura de los **tickets de combustible de Waylet** (Repsol / ES GLEM S.L) que el propietario
se envía por correo (`from:benicolo@gmail.com`, asunto `Waylet - ES GLEM S.L <localidad>`).
El correo **no adjunta** el ticket: contiene un **enlace directo al PDF**, que se descarga,
se parsea, se almacena en InsForge y se puede **vincular a los movimientos bancarios**.

## 2. Historias de usuario

- **HU-1**: Como propietario, quiero que mis tickets Waylet lleguen solos, descargando el PDF
  desde el enlace del correo.
- **HU-2**: Como propietario, quiero ver mis repostajes con litros y **€/L**.
- **HU-3**: Como propietario, quiero gráficas de gasto, litros y **evolución del €/L**.
- **HU-4**: Como propietario, quiero **vincular** un repostaje con su cargo `REPSOL WAYLET` del banco.
- **HU-5**: Como propietario, quiero **importar el histórico** desde el buzón.

## 3. Requisitos funcionales

- **FR-001**: Workflow n8n con trigger Gmail `from:benicolo@gmail.com` + `subject:Waylet`.
- **FR-002**: Extraer del cuerpo el **enlace**:
  `https://waylet.repsol.everiscloudpayments.com/waylet/api/public/klikin/ticket-services/v1/ticket/<TOKEN>`.
- **FR-003**: Descargar el PDF (**GET directo, sin login**) y extraer su texto.
- **FR-004**: Parser: estación, dirección, CP/localidad, fecha/hora, carburante, **litros**,
  **€/L**, importe bruto, **descuento**, **total**, pago, tarjeta, nº de ticket, id Waylet,
  y **líneas** (carburante + descuentos).
- **FR-005**: RPC `waylet_upsert_ticket(p_ticket, p_lines)` idempotente (por `ticket_number`).
- **FR-006**: Guardar el PDF en el bucket privado `waylet`.
- **FR-007**: `/combustible` (lista + totales + gráficas) y `/combustible/[id]` (detalle + líneas + PDF).
- **FR-008**: `bank_match_waylet` sugiere repostajes para un movimiento; `target_type='waylet'`.
- **FR-009**: `waylet_ticket_message_ids()` → `{ids:[…]}` para el backfill.

## 4. Criterios de aceptación

- **SC-1**: El parser extrae correctamente todos los campos del PDF de muestra.
- **SC-2**: El total = importe bruto − descuento; coincide con el `Total Venta`.
- **SC-3**: Reimportar no duplica (por `ticket_number` y `message_id`).
- **SC-4**: **Ver PDF** abre el ticket del bucket privado.
- **SC-5**: El repostaje de −46,73 € del 28‑08‑2026 se puede vincular a su cargo bancario.

## 5. Fuera de alcance

- Otras app de combustible.
- OCR (el PDF es digital).
- Cálculo de puntos (no aparecen en el ticket de muestra).

## 6. Supuestos

- El correo es un reenvío propio desde `benicolo@gmail.com` con asunto `Waylet - ES GLEM S.L <localidad>`.
- El enlace es estable y **público** (sin sesión) y devuelve el PDF directamente.
- Formato español de números (`1.234,56`).
