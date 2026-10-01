function norm(s) {
  return String(s == null ? "" : s).replace(/\uFB01/g, "fi").replace(/\uFB02/g, "fl");
}
function esNum(s) {
  if (s == null) return null;
  var v = String(s).trim().replace(/\s/g, "");
  if (!v) return null;
  if (v.indexOf(",") >= 0) v = v.replace(/\./g, "").replace(",", ".");
  var n = parseFloat(v);
  return isNaN(n) ? null : n;
}
function pad(n) {
  return String(n).padStart(2, "0");
}
function round2(n) {
  return n == null ? null : Math.round(n * 100) / 100;
}
function isoDate(s) {
  var m = String(s || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? m[3] + "-" + pad(m[2]) + "-" + pad(m[1]) : null;
}
var MONTHS = {
  enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
  julio: "07", agosto: "08", septiembre: "09", setiembre: "09", octubre: "10", noviembre: "11", diciembre: "12"
};
function isoLongDate(s) {
  var m = String(s || "").trim().match(/^(\d{1,2}) de ([a-z\u00e1\u00e9\u00ed\u00f3\u00fa]+) de (\d{4})$/i);
  if (!m) return null;
  var mo = MONTHS[m[2].toLowerCase()];
  return mo ? m[3] + "-" + mo + "-" + pad(m[1]) : null;
}

function parseIberdrola(rawText) {
  var text = norm(rawText);
  var t = { raw_text: text };
  var m;
  m = text.match(/Nº FACTURA:\s*(\d{17})/); if (m) t.invoice_number = m[1];
  m = text.match(/Nº DE CONTRATO:\s*(\d+)/); if (m) t.contract_number = m[1];
  m = text.match(/PERIODO DE FACTURACIÓN:\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/);
  if (m) { t.period_start = isoDate(m[1]); t.period_end = isoDate(m[2]); }
  m = text.match(/FECHA DE EMISIÓN:\s*([^\n]+)/); if (m) t.issue_date = isoLongDate(m[1]);
  m = text.match(/FECHA PREVISTA DE COBRO:\s*(\d{2}\/\d{2}\/\d{4})/); if (m) t.due_date = isoDate(m[1]);
  m = text.match(/DIAS FACTURADOS:\s*(\d+)/); if (m) t.days_billed = parseInt(m[1], 10);
  m = text.match(/TOTAL\s*\n\s*([\d.]+,\d{2})\s*€/); if (m) t.total = esNum(m[1]);
  m = text.match(/ENERGÍA\.{3,}\s*([\d.]+,\d{2})\s*€/); if (m) t.energy_amount = esNum(m[1]);
  m = text.match(/CARGOS NORMATIVOS\s*\.{3,}\s*([\d.]+,\d{2})\s*€/); if (m) t.charges_amount = esNum(m[1]);
  m = text.match(/SERVICIOS Y OTROS CONCEPTOS\.{3,}\s*([\d.]+,\d{2})\s*€/); if (m) t.services_amount = esNum(m[1]);
  m = text.match(/IVA\.{3,}\s*([\d.]+,\d{2})\s*€/); if (m) t.tax_amount = esNum(m[1]);
  if (t.total != null && t.tax_amount != null) t.subtotal = round2(t.total - t.tax_amount);
  m = text.match(/Potencia punta:\s*([\d.,]+)\s*kW\s*Potencia valle:\s*([\d.,]+)\s*kW/i);
  if (m) { t.contracted_power_punta = esNum(m[1]); t.contracted_power_valle = esNum(m[2]); }
  m = text.match(/\b(\d\.\dTD)\b/); if (m) t.tariff = m[1];
  m = text.match(/\b(\d{8}[A-Z])\b/); if (m) t.nif = m[1];
  m = text.match(/(ES\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?[A-Z]{2})/); if (m) t.cups = m[1].trim();
  m = text.match(/Titular\s*\n\s*([^\n]+)/); if (m) t.titular = m[1].trim();
  m = text.match(/Dirección de suministro:\s*\n?\s*([^\n]+)/i);
  if (m) {
    t.supply_address = m[1].trim();
    var city = t.supply_address.match(/\b(\d{5})\s+([A-Za-zÁÉÍÓÚÑáéíóúñ\s]+?)\s*\(/);
    if (city) t.city = city[1] + " " + city[2].trim();
    var street = t.supply_address.match(/C\/\s*([^,]+)/i);
    if (street) t.contract_label = street[1].trim();
  }

  var consumption = [];
  m = text.match(/consumos desagregados han sido punta:?\s*([\d.,]+)\s*kWh;?\s*llano:?\s*([\d.,]+)\s*kWh;?\s*valle:?\s*([\d.,]+)\s*kWh/i);
  if (m) {
    consumption.push({ tramo: "punta", kwh: esNum(m[1]) }, { tramo: "llano", kwh: esNum(m[2]) }, { tramo: "valle", kwh: esNum(m[3]) });
    t.consumption_kwh = round2((esNum(m[1]) || 0) + (esNum(m[2]) || 0) + (esNum(m[3]) || 0));
  } else {
    var g = text.match(/([\d.,]+)\s*kWh\s*\n\s*[\d.,]+\s*€[\s\S]{0,40}?Consumo total/i);
    if (g) t.consumption_kwh = esNum(g[1]);
  }

  var found = [];
  var energyMatches = [];
  function collect(re, fn) { var mm; while ((mm = re.exec(text)) !== null) found.push({ index: mm.index, data: fn(mm) }); }
  collect(/(Punta|Valle)\s+([\d.,]+)\s*kW\s*x\s*(\d+)\s*d[ií]as\s*x\s*([\d.,]+)\s*€\s*\/\s*kW\s*d[ií]a/gi, function (mm) {
    var qty = esNum(mm[2]), days = parseInt(mm[3], 10), price = esNum(mm[4]);
    return { group: "power", line_type: "potencia_" + mm[1].toLowerCase(), tramo: mm[1].toLowerCase(), concept: "Potencia " + mm[1].toLowerCase(), detail: mm[0].trim(), quantity: qty, unit: "kW", unit_price: price, days: days, amount: round2(qty * days * price) };
  });
  collect(/([\d.,]+)\s*kWh\s*x\s*([\d.,]+)\s*€\s*\/\s*kWh/gi, function (mm) {
    var qty = esNum(mm[1]), price = esNum(mm[2]);
    var isFnee = price != null && price < 0.01;
    var line = { group: "energy", line_type: isFnee ? "energia_fnee" : "energia", tramo: null, concept: isFnee ? "Regularización FNEE" : "Energía consumida", detail: mm[0].trim(), quantity: qty, unit: "kWh", unit_price: price, amount: round2(qty * price) };
    energyMatches.push(line);
    return line;
  });
  var dayLines = [];
  collect(/(\d+)\s*d[ií]as\s*x\s*([\d.,]+)\s*€\s*\/\s*d[ií]a/gi, function (mm) {
    var days = parseInt(mm[1], 10), price = esNum(mm[2]);
    var line = { group: "charges", line_type: "bono_social", concept: "Financiación bono social fijo", detail: mm[0].trim(), quantity: days, unit: "días", unit_price: price, days: days, amount: round2(days * price) };
    dayLines.push(line);
    return line;
  });
  collect(/([\d.,]+)\s*mes(?:es)?\s*x\s*([\d.,]+)\s*€\s*\/\s*mes/gi, function (mm) {
    var qty = esNum(mm[1]), price = esNum(mm[2]);
    return { group: "services", line_type: "proteccion_hogar", concept: "Protección Eléctrica Hogar", detail: mm[0].trim(), quantity: qty, unit: "meses", unit_price: price, amount: round2(qty * price) };
  });
  collect(/([\d.,]+)\s*%\s*s\s*\/\s*([\d.,]+)\s*€/gi, function (mm) {
    var rate = esNum(mm[1]), base = esNum(mm[2]);
    var isIva = rate != null && rate > 7;
    return { group: "taxes", line_type: isIva ? "iva" : "impuesto_electricidad", concept: isIva ? "IVA" : "Impuesto sobre electricidad", detail: mm[0].trim(), unit: "%", unit_price: null, vat_rate: rate, tax_base: base, amount: round2((rate / 100) * base) };
  });
  for (var d = 0; d < dayLines.length; d++) {
    if (d === 1) { dayLines[d].group = "services"; dayLines[d].line_type = "alquiler_contador"; dayLines[d].concept = "Alquiler equipos medida"; }
  }
  found.sort(function (a, b) { return a.index - b.index; });
  var lines = found.map(function (f, i) { var o = f.data; o.line_no = i + 1; return o; });
  if (t.consumption_kwh == null && energyMatches.length) {
    var s = 0;
    for (var e = 0; e < energyMatches.length; e++) s += (energyMatches[e].quantity || 0);
    t.consumption_kwh = round2(s);
  }
  t.lines = lines;
  return { header: t, lines: lines, consumption: consumption };
}

module.exports = { parseIberdrola: parseIberdrola, esNum: esNum, round2: round2 };
