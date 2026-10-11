// Parser de la nota de entrega / factura de TRANSPORTES ALBERO S.L. (gasóleo C).
// Soporta el texto de `pdftotext` (columnas apiladas) y el de n8n (columnas preservadas).
// El texto puede traer acentos mojibake ("�"), así que los patrones son tolerantes.

function norm(s) {
  return String(s == null ? "" : s).replace(/\uFB01/g, "fi").replace(/\uFB02/g, "fl").replace(/\u00a0/g, " ");
}
function esNum(s) {
  if (s == null) return null;
  var v = String(s).trim().replace(/\s/g, "").replace(/€/g, "");
  if (!v) return null;
  if (v.indexOf(",") >= 0) v = v.replace(/\./g, "").replace(",", ".");
  var n = parseFloat(v);
  return isNaN(n) ? null : n;
}
function isoDate(dmy) {
  var m = String(dmy || "").match(/(\d{2})-(\d{2})-(\d{4})/);
  return m ? m[3] + "-" + m[2] + "-" + m[1] : null;
}

function parseAlbero(rawText) {
  var text = norm(rawText);
  var t = { raw_text: text };
  var m;

  // Proveedor
  t.supplier_name = "TRANSPORTES ALBERO S.L.";
  if (/B0?3075116/.test(text)) t.supplier_tax_id = "B03075116";
  m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (m) t.supplier_email = m[0];
  m = text.match(/\b(9\d{8})\b/);
  if (m) t.supplier_phone = m[1];

  // Datos del documento
  m = text.match(/CAE\s+exp\S*[\s\S]{0,60}?([A-Z]{2}\d{3,}[A-Z0-9]+)/i);
  if (m) t.cae = m[1];
  m = text.match(/C\.?\s*R\.?\s*E\.?\s*([A-Z0-9]{6,})/i);
  if (m) t.cre = m[1];
  m = text.match(/Ref\.?\s*Local\s*([A-Z0-9]+)/i);
  if (m) t.ref_local = m[1];

  // Factura (número + fecha) y albarán/pedido
  m = text.match(/Factura:\s*(\d+)\s*de\s*(\d{2}-\d{2}-\d{4})/i);
  if (m) {
    t.invoice_number = m[1];
    t.issue_date = isoDate(m[2]);
  }
  if (!t.invoice_number) {
    m = text.match(/Factura[^\d]{0,20}(\d{3,})/i);
    if (m) t.invoice_number = m[1];
  }
  m = text.match(/albar\S{0,3}n:?\s*(\d{3,})/i);
  if (m) t.albaran = m[1];
  m = text.match(/pedido:\s*([^\n]*?)(?=\s{2,}|Alb\.|circu|\n|$)/i);
  if (m) t.pedido = m[1].trim().replace(/\s+/g, " ");
  m = text.match(/circu\.?:?\s*([A-Z0-9]+)/i);
  if (m) t.alb_circu = m[1];

  // Fecha de entrega
  m = text.match(/Fecha de entrega\s*(\d{2}-\d{2}-\d{4})/i);
  if (m) t.delivery_date = isoDate(m[1]);

  // Producto (5d): en n8n va en la misma línea; en pdftotext -layout, en la siguiente
  m = text.match(/Nombre del producto\s+([A-Z][A-Z0-9\s.\/-]{2,40})/i);
  if (!m) m = text.match(/Nombre del producto[^\n]*\n\s*([A-Z][A-Z0-9\s.\/-]{2,40})/i);
  if (!m) m = text.match(/Producto\s+([A-Z][A-Z0-9\s.\/-]{2,40})/);
  if (m) t.product = m[1].trim().replace(/\s+/g, " ");

  // Unidad (5a) + cantidad (5c) — LTR/LT/KG/UD (evita la "L" de "S.L.")
  m = text.match(/\b(LTR|LT|KG|UD)\b/) || text.match(/\b(LTR|LT|KG|UD)\b/i);
  if (m) t.unit = m[1].toUpperCase();
  m = text.match(/LTR\s+(\d{1,7})/i) || text.match(/Cantidad\s+(\d{1,7})/i);
  if (m) t.quantity = esNum(m[1]);

  // Precio unitario (6 decimales típico)
  m = text.match(/(\d{1,4},\d{6})/);
  if (m) t.unit_price = esNum(m[1]);

  // Totales
  m = text.match(/IMPONIBLE:?\s*([\d.,]+)/i);
  if (m) t.base = esNum(m[1]);
  m = text.match(/%\s*IVA\s*([\d.,]+)/i);
  if (m) t.vat_rate = esNum(m[1]);
  m = text.match(/TOTAL\s*IVA:?\s*([\d.,]+)/i);
  if (m) t.vat_amount = esNum(m[1]);
  m = text.match(/(?:^|\n)[^\n]*TOTAL:?\s*([\d.,]+)/i);
  if (m) t.total = esNum(m[1]);
  if (t.total == null && t.base != null && t.vat_amount != null) t.total = Math.round((t.base + t.vat_amount) * 100) / 100;
  t.amount = t.total;

  // Forma de pago
  m = text.match(/FORMA DE PAGO:?\s*([^\n]+)/i);
  if (m) t.payment_method = m[1].replace(/\s+/g, " ").trim();

  // Vehículo, conductor y densidad
  m = text.match(/Matr\S*?cula\s*([A-Z0-9]{4,8})/i);
  if (m) t.plate = m[1];
  m = text.match(/Conductor\s+(?!Densidad)([A-Z][A-Z .]{3,40})/i);
  if (m) t.driver = m[1].trim().replace(/\s+/g, " ");
  m = text.match(/Densidad\s*15\S?\s*C:?\s*([\d.,]+)/i);
  if (m) t.density = esNum(m[1]);

  // Cliente (destinatario): nombre antes de "Titular"
  m = text.match(/([A-Z][A-Z ]{5,40})\s*\n\s*Titular/);
  if (m) t.customer_name = m[1].trim().replace(/\s+/g, " ");
  m = text.match(/(\d{8}[A-Z])\b/);
  if (m) t.customer_tax_id = m[1];

  // Línea única
  var lines = [];
  if (t.product || t.total != null) {
    lines.push({
      product_name: t.product || "GASOLEO C",
      quantity: t.quantity,
      unit: t.unit,
      unit_price: t.unit_price,
      amount: t.amount,
    });
  }

  return { header: t, lines: lines };
}

module.exports = { parseAlbero: parseAlbero, esNum: esNum };
