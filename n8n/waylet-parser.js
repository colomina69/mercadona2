function norm(s) {
  return String(s == null ? "" : s).replace(/\uFB01/g, "fi").replace(/\uFB02/g, "fl");
}
function esNum(s) {
  if (s == null) return null;
  var v = String(s).trim().replace(/\s/g, "").replace(/€/g, "");
  if (!v) return null;
  if (v.indexOf(",") >= 0) v = v.replace(/\./g, "").replace(",", ".");
  var n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function parseWaylet(rawText) {
  var text = norm(rawText);
  var t = { raw_text: text };
  var m;
  var discountLabel = null;

  // Station + address + postal code / locality
  m = text.match(/(ES\s+GLEM\s+S\.?L\.?)/i);
  if (m) t.station_name = m[1].replace(/\s+/g, " ").trim();
  else {
    m = text.match(/(GLEM\s+S\.?L\.?)/i);
    if (m) t.station_name = m[1].trim();
  }
  m = text.match(/(C\/|CL)\s+[^\n]+/);
  if (m) t.address = m[0].trim();
  m = text.match(/(\d{5})\s*-\s*([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑ ]+)/);
  if (m) {
    t.postal_code = m[1];
    t.locality = m[2].trim();
  }

  // Date + time
  m = text.match(/Fecha:\s*(\d{2})-(\d{2})-(\d{4})/);
  var fecha = m ? m[3] + "-" + m[2] + "-" + m[1] : null;
  m = text.match(/Hora:\s*(\d{2}:\d{2}(?::\d{2})?)/);
  var hora = m ? m[1] : null;
  t.purchased_at = fecha ? fecha + "T" + (hora ? (hora.length === 5 ? hora + ":00" : hora) : "00:00:00") : null;

  // Product table.
  // Layout A (n8n Extract): columns preserved on one header line
  //   PRODUCTO €/L LITROS IMPORTE
  //   Diesel e+ 1,939 25,78 49,99
  m = text.match(/PRODUCTO\s+€\/L\s+LITROS\s+IMPORTE\s*\n\s*([^\n]+?)\s+(-?[\d.,]+)\s+(-?[\d.,]+)\s+(-?[\d.,]+)/i);
  if (m) {
    t.fuel_type = m[1].trim();
    t.unit_price = esNum(m[2]);
    t.liters = esNum(m[3]);
    t.gross_amount = esNum(m[4]);
    var rest = text.slice(m.index + m[0].length);
    var dm = rest.match(/\n\s*([^\n]+?)\s+(-[\d.,]+)\s*\n/);
    if (dm && !/Total/i.test(dm[1])) discountLabel = dm[1].trim();
    if (dm && !/Total/i.test(dm[1])) t.discount_amount = Math.abs(esNum(dm[2]));
  } else {
    // Layout B (pdftotext): columns stacked
    m = text.match(/PRODUCTO\s*€\/L\s*([^\n]+)\s+([\d.,]+)/i);
    if (m) {
      t.fuel_type = m[1].trim();
      t.unit_price = esNum(m[2]);
    }
    m = text.match(/LITROS\s*([\d.,]+)/i);
    if (m) t.liters = esNum(m[1]);
    m = text.match(/([^\n]+)\n\s*LITROS/i);
    if (m && m[1] && !/^[\d.,\s]+$/.test(m[1])) discountLabel = m[1].trim();
    m = text.match(/IMPORTE\s+(-?[\d.,]+)\s+(-?[\d.,]+)/i);
    if (m) {
      t.gross_amount = esNum(m[1]);
      t.discount_amount = Math.abs(esNum(m[2]));
    }
  }

  // Totals
  m = text.match(/Total descuento:\s*([\d.,]+)\s*€/i);
  if (m && (t.discount_amount == null || t.discount_amount === 0)) t.discount_amount = Math.abs(esNum(m[1]));
  m = text.match(/Total Venta:\s*([\d.,]+)\s*€/i);
  if (m) t.total = esNum(m[1]);
  if (t.total == null) {
    m = text.match(/Total tarjeta:\s*([\d.,]+)\s*€/i);
    if (m) t.total = esNum(m[1]);
  }

  // Payment
  m = text.match(/Pago Waylet\s+(.+?)\s*\*+(\d{4})/i);
  if (m) {
    t.payment_method = m[1].replace(/\s+/g, " ").trim();
    t.card_last4 = m[2];
  }

  // Ticket number + waylet id
  m = text.match(/N\.?\s*de ticket\s*(\d+)/i);
  if (m) t.ticket_number = m[1];
  m = text.match(/Id:\s*([0-9a-fA-F-]{36})/);
  if (m) t.waylet_id = m[1];

  // Lines (primary fuel + discount / other products)
  var lines = [];
  if (t.fuel_type || t.gross_amount != null) {
    lines.push({ product_name: t.fuel_type || "Combustible", unit_price: t.unit_price, amount: t.gross_amount });
  }
  if (t.discount_amount != null && t.discount_amount > 0) {
    lines.push({ product_name: discountLabel || "Descuento", unit_price: null, amount: -t.discount_amount });
  }

  return { header: t, lines: lines };
}

module.exports = { parseWaylet: parseWaylet, esNum: esNum };
