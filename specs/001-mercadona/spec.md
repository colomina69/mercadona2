# Especificación — Mercadona (tickets y productos)

**ID**: 001-mercadona · **Estado**: implementado

## 1. Resumen

Ingesta automática de los **tickets de Mercadona** recibidos por email, extracción de
sus líneas de producto, y consulta del gasto, tiendas, catálogo y evolución de precios.

## 2. Historias de usuario

- **HU-1**: Como propietario, quiero que mis tickets lleguen solos a la base de datos al
  recibirlos por email, para no subirlos a mano.
- **HU-2**: Como propietario, quiero ver un listado de tickets con tienda, fecha e importe
  y filtrarlos.
- **HU-3**: Como propietario, quiero abrir un ticket y ver sus líneas y el PDF original.
- **HU-4**: Como propietario, quiero buscar un producto y ver su histórico de precios.
- **HU-5**: Como propietario, quiero un dashboard con gasto por mes, por tienda y top productos.

## 3. Requisitos funcionales

- **FR-001**: Un workflow n8n con trigger Gmail (`from:ticket_digital@mail.mercadona.com`,
  `has:attachment filename:pdf`) descarga los PDFs.
- **FR-002**: El PDF se convierte a texto y se parsea a un objeto ticket (cabecera) y líneas.
- **FR-003**: La RPC `mercadona_upsert_ticket(p_ticket, p_items)` hace upsert por `message_id`
  y reemplaza las líneas; devuelve `{ id, message_id, pdf_key }`.
- **FR-004**: El PDF se guarda en el bucket privado `mercadona`.
- **FR-005**: La app lista y filtra tickets (texto, tienda, rango de fechas, importe).
- **FR-006**: El detalle del ticket muestra cabecera, líneas, desglose de IVA y PDF.
- **FR-007**: `mercadona_products(q, lim)` lista productos con nº de compras, última fecha,
  precio último y medio. `mercadona_product_history(name)` da la serie de precios.
- **FR-008**: Los alias de producto (`mercadona_product_aliases`) permiten normalizar nombres.
- **FR-009**: `mercadona_spend_summary()` devuelve totales, serie mensual, por tienda y top productos.
- **FR-010**: Un workflow de backfill (`mercadona_tickets.js`) importa tickets históricos sin
  duplicar, comparando `message_id` y objetos ya presentes en el bucket.

## 4. Criterios de aceptación

- **SC-1**: Al llegar un email nuevo de ticket, aparece en `/tickets` sin intervención manual.
- **SC-2**: Reimportar el mismo ticket no crea filas duplicadas (`ON CONFLICT (message_id)`).
- **SC-3**: El botón **Ver PDF original** abre el PDF del bucket privado del propietario.
- **SC-4**: `/` muestra el gasto total, ticket medio y gráficas coherentes con los tickets.
- **SC-5**: El parser se valida contra PDFs de ejemplo produciendo totales iguales a los impresos.

## 5. Fuera de alcance

- Tickets de otras cadenas.
- OCR de tickets en imagen (los PDFs son digitales).
- Multiusuario.

## 6. Supuestos

- Los tickets llegan como PDF adjunto de `ticket_digital@mail.mercadona.com`.
- El propietario es único (uid fijo usado en RLS).
