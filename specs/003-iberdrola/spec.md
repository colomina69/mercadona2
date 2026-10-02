# Especificación — Facturas Iberdrola (contratos y precios)

**ID**: 003-iberdrola · **Estado**: implementado

## 1. Resumen

Ingesta de las **facturas de Iberdrola** (PDF por email), extracción de la cabecera, el
**desglose de líneas con €/kW·día y €/kWh** y el **consumo por tramo** (punta/llano/valle),
agrupación por **contrato**, y gráficas de **evolución del precio** de la luz.

## 2. Historias de usuario

- **HU-1**: Como propietario, quiero que mis facturas de Iberdrola lleguen solas por email.
- **HU-2**: Como propietario, quiero ver mis facturas **divididas por contrato**.
- **HU-3**: Como propietario, quiero ver el **desglose** de cada factura (potencia en €/kW·día,
  energía en €/kWh, cargos, servicios, impuestos) y el consumo por tramo.
- **HU-4**: Como propietario, quiero **gráficas** de cómo ha variado el precio (€/kWh y €/kW·día).
- **HU-5**: Como propietario, quiero **vincular** una factura con su cargo en el banco.
- **HU-6**: Como propietario, quiero **importar el histórico** de facturas antiguas del buzón.

## 3. Requisitos funcionales

- **FR-001**: Workflow n8n con trigger Gmail (`from:clientes@clientesiberdrola.es`,
  `has:attachment filename:pdf`) + workflow de **backfill** manual.
- **FR-002**: Parser (regex) que extrae: nº de contrato, nº de factura, fechas (emisión,
  periodo, cobro), importes (total, subtotal, energía, cargos, servicios, IVA), consumo total,
  CUPS, tarifa (ATR), potencias, titular, NIF, dirección y el bloque de líneas.
- **FR-003**: Las **líneas** se derivan de las fórmulas del detalle:
  - `Punta/Valle <kW> x <días> x <€/kW día>` → `group=power`, `unit=kW`, `unit_price=€/kW·día`.
  - `<kWh> x <€/kWh>` → `group=energy`, `unit=kWh`, `unit_price=€/kWh` (incluye FNEE).
  - `días x €/día` (bono social, alquiler contador), `meses x €/mes` (protección),
    `% s/ base` (impuesto electricidad, IVA).
- **FR-004**: **Consumo por tramo** a partir de las lecturas desagregadas (punta/llano/valle).
- **FR-005**: La RPC `iberdrola_upsert_invoice(p_invoice, p_lines, p_consumption)` hace upsert
  del **contrato** (por `contract_number`) y de la **factura** (por `invoice_number`), y
  reemplaza líneas y consumo.
- **FR-006**: El **PDF** se guarda en el bucket privado `iberdrola`.
- **FR-007**: `/facturas` agrupa por contrato (secciones plegables con totales y acento de color).
- **FR-008**: `/contratos` y `/contratos/[id]` muestran totales por contrato, consumo por tramo
  y **gráficas de evolución** de €/kWh y €/kW·día.
- **FR-009**: `bank_match_invoices` sugiere facturas para un movimiento bancario.
- **FR-010**: `iberdrola_invoice_message_ids()` devuelve `{ids:[...]}` para el backfill.

## 4. Criterios de aceptación

- **SC-1**: El parser se valida contra **29 PDFs** locales (14 SANT LLORENC + 15 SANT PERE) — 29/29 OK.
- **SC-2**: La suma de líneas de cada factura coincide con el total impreso (± redondeo).
- **SC-3**: El backfill importa el histórico sin duplicar (por `invoice_number` y `message_id`).
- **SC-4**: **Ver PDF original** abre el PDF (requiere política de storage del bucket `iberdrola`).
- **SC-5**: Los dos contratos quedan diferenciados con sus totales y sus gráficas de precio.

## 5. Fuera de alcance

- Facturas de otros comercializadores (previsto: `target_type` genérico y, si procede, migrar a
  un modelo genérico de facturas).
- OCR (los PDFs son digitales).
- Reparto de tramos llano en el precio de energía cuando la tarifa es de precio único (se guarda
  el €/kWh de la línea y, aparte, el consumo por tramo).

## 6. Supuestos

- Las facturas llegan **adjuntas** en PDF desde `clientes@clientesiberdrola.es`.
- Contrato `279914829` (SANT LLORENC) y `448003284` (SANT PERE); tarifa 2.0TD.
- Formato español (`1.234,56`, `€` al final).
