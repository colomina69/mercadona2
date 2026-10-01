import { workflow, node, trigger, newCredential } from '@n8n/workflow-sdk';

const INS_FORGE_BASE = 'https://insforge.benicolo.com';
const BUCKET = 'iberdrola';

const startTrigger = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Start', position: [200, 400] },
  output: [{}]
});

const listMessageIds = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'List Existing Message Ids',
    parameters: {
      method: 'POST',
      url: INS_FORGE_BASE + '/api/database/rpc/iberdrola_invoice_message_ids',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      options: {}
    },
    credentials: { httpHeaderAuth: newCredential('InsForge') },
    position: [420, 400]
  },
  output: [{ ids: ['18f0000000000000'] }]
});

const listObjects = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'List Existing Objects',
    parameters: {
      method: 'GET',
      url: INS_FORGE_BASE + '/api/storage/buckets/' + BUCKET + '/objects?limit=1000',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      options: {}
    },
    credentials: { httpHeaderAuth: newCredential('InsForge') },
    position: [640, 400]
  },
  output: [{ data: [{ key: 'iberdrola/example/factura.pdf' }] }]
});

const getInvoices = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Get Invoices',
    parameters: {
      resource: 'message',
      operation: 'getAll',
      returnAll: true,
      simple: false,
      filters: {
        q: 'from:clientes@clientesiberdrola.es has:attachment filename:pdf',
        readStatus: 'both'
      },
      options: {
        downloadAttachments: true,
        dataPropertyAttachmentsPrefixName: 'attachment_'
      }
    },
    credentials: { gmailOAuth2: newCredential('Gmail account') },
    position: [860, 400]
  },
  output: [{ id: '18f0000000000000', subject: 'Tu factura de luz' }]
});

const expandPdfs = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Expand PDFs',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "const out = [];\nfor (const item of $input.all()) {\n  const bin = item.binary || {};\n  const id = (item.json && item.json.id) ? item.json.id : \"unknown\";\n  for (const prop of Object.keys(bin)) {\n    const meta = bin[prop];\n    if (prop.indexOf(\"attachment_\") === 0 && meta && meta.mimeType === \"application/pdf\") {\n      const name = meta.fileName ? meta.fileName : (prop + \".pdf\");\n      const safeName = String(name).replace(/[^A-Za-z0-9._-]+/g, \"_\");\n      out.push({\n        json: { messageId: id, filename: name, mimeType: meta.mimeType, size: meta.fileSize || 0, safeName: safeName },\n        binary: { data: bin[prop] }\n      });\n    }\n  }\n}\nreturn out;" },
    position: [1080, 400]
  },
  output: [{ messageId: '18f0000000000000', filename: 'factura.pdf', safeName: 'factura.pdf' }]
});

const extractPdf = node({
  type: 'n8n-nodes-base.extractFromFile',
  version: 1.1,
  config: {
    name: 'Extract PDF Text',
    parameters: { operation: 'pdf', binaryPropertyName: 'data', options: { keepSource: 'both' } },
    onError: 'continueRegularOutput',
    position: [1300, 400]
  },
  output: [{ text: 'FACTURA DE ELECTRICIDAD ...' }]
});

const parseInvoice = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse Iberdrola',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "function norm(s) {\n  return String(s == null ? \"\" : s).replace(/\\uFB01/g, \"fi\").replace(/\\uFB02/g, \"fl\");\n}\nfunction esNum(s) {\n  if (s == null) return null;\n  var v = String(s).trim().replace(/\\s/g, \"\");\n  if (!v) return null;\n  if (v.indexOf(\",\") >= 0) v = v.replace(/\\./g, \"\").replace(\",\", \".\");\n  var n = parseFloat(v);\n  return isNaN(n) ? null : n;\n}\nfunction pad(n) {\n  return String(n).padStart(2, \"0\");\n}\nfunction round2(n) {\n  return n == null ? null : Math.round(n * 100) / 100;\n}\nfunction isoDate(s) {\n  var m = String(s || \"\").trim().match(/^(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})$/);\n  return m ? m[3] + \"-\" + pad(m[2]) + \"-\" + pad(m[1]) : null;\n}\nvar MONTHS = {\n  enero: \"01\", febrero: \"02\", marzo: \"03\", abril: \"04\", mayo: \"05\", junio: \"06\",\n  julio: \"07\", agosto: \"08\", septiembre: \"09\", setiembre: \"09\", octubre: \"10\", noviembre: \"11\", diciembre: \"12\"\n};\nfunction isoLongDate(s) {\n  var m = String(s || \"\").trim().match(/^(\\d{1,2}) de ([a-z\\u00e1\\u00e9\\u00ed\\u00f3\\u00fa]+) de (\\d{4})$/i);\n  if (!m) return null;\n  var mo = MONTHS[m[2].toLowerCase()];\n  return mo ? m[3] + \"-\" + mo + \"-\" + pad(m[1]) : null;\n}\n\nfunction parseIberdrola(rawText) {\n  var text = norm(rawText);\n  var t = { raw_text: text };\n  var m;\n  m = text.match(/Nº FACTURA:\\s*(\\d{17})/); if (m) t.invoice_number = m[1];\n  m = text.match(/Nº DE CONTRATO:\\s*(\\d+)/); if (m) t.contract_number = m[1];\n  m = text.match(/PERIODO DE FACTURACIÓN:\\s*(\\d{2}\\/\\d{2}\\/\\d{4})\\s*-\\s*(\\d{2}\\/\\d{2}\\/\\d{4})/);\n  if (m) { t.period_start = isoDate(m[1]); t.period_end = isoDate(m[2]); }\n  m = text.match(/FECHA DE EMISIÓN:\\s*([^\\n]+)/); if (m) t.issue_date = isoLongDate(m[1]);\n  m = text.match(/FECHA PREVISTA DE COBRO:\\s*(\\d{2}\\/\\d{2}\\/\\d{4})/); if (m) t.due_date = isoDate(m[1]);\n  m = text.match(/DIAS FACTURADOS:\\s*(\\d+)/); if (m) t.days_billed = parseInt(m[1], 10);\n  m = text.match(/TOTAL\\s*\\n\\s*([\\d.]+,\\d{2})\\s*€/); if (m) t.total = esNum(m[1]);\n  m = text.match(/ENERGÍA\\.{3,}\\s*([\\d.]+,\\d{2})\\s*€/); if (m) t.energy_amount = esNum(m[1]);\n  m = text.match(/CARGOS NORMATIVOS\\s*\\.{3,}\\s*([\\d.]+,\\d{2})\\s*€/); if (m) t.charges_amount = esNum(m[1]);\n  m = text.match(/SERVICIOS Y OTROS CONCEPTOS\\.{3,}\\s*([\\d.]+,\\d{2})\\s*€/); if (m) t.services_amount = esNum(m[1]);\n  m = text.match(/IVA\\.{3,}\\s*([\\d.]+,\\d{2})\\s*€/); if (m) t.tax_amount = esNum(m[1]);\n  if (t.total != null && t.tax_amount != null) t.subtotal = round2(t.total - t.tax_amount);\n  m = text.match(/Potencia punta:\\s*([\\d.,]+)\\s*kW\\s*Potencia valle:\\s*([\\d.,]+)\\s*kW/i);\n  if (m) { t.contracted_power_punta = esNum(m[1]); t.contracted_power_valle = esNum(m[2]); }\n  m = text.match(/\\b(\\d\\.\\dTD)\\b/); if (m) t.tariff = m[1];\n  m = text.match(/\\b(\\d{8}[A-Z])\\b/); if (m) t.nif = m[1];\n  m = text.match(/(ES\\s?\\d{4}\\s?\\d{4}\\s?\\d{4}\\s?\\d{4}\\s?[A-Z]{2})/); if (m) t.cups = m[1].trim();\n  m = text.match(/Titular\\s*\\n\\s*([^\\n]+)/); if (m) t.titular = m[1].trim();\n  m = text.match(/Dirección de suministro:\\s*\\n?\\s*([^\\n]+)/i);\n  if (m) {\n    t.supply_address = m[1].trim();\n    var city = t.supply_address.match(/\\b(\\d{5})\\s+([A-Za-zÁÉÍÓÚÑáéíóúñ\\s]+?)\\s*\\(/);\n    if (city) t.city = city[1] + \" \" + city[2].trim();\n    var street = t.supply_address.match(/C\\/\\s*([^,]+)/i);\n    if (street) t.contract_label = street[1].trim();\n  }\n\n  var consumption = [];\n  m = text.match(/consumos desagregados han sido punta:?\\s*([\\d.,]+)\\s*kWh;?\\s*llano:?\\s*([\\d.,]+)\\s*kWh;?\\s*valle:?\\s*([\\d.,]+)\\s*kWh/i);\n  if (m) {\n    consumption.push({ tramo: \"punta\", kwh: esNum(m[1]) }, { tramo: \"llano\", kwh: esNum(m[2]) }, { tramo: \"valle\", kwh: esNum(m[3]) });\n    t.consumption_kwh = round2((esNum(m[1]) || 0) + (esNum(m[2]) || 0) + (esNum(m[3]) || 0));\n  } else {\n    var g = text.match(/([\\d.,]+)\\s*kWh\\s*\\n\\s*[\\d.,]+\\s*€[\\s\\S]{0,40}?Consumo total/i);\n    if (g) t.consumption_kwh = esNum(g[1]);\n  }\n\n  var found = [];\n  var energyMatches = [];\n  function collect(re, fn) { var mm; while ((mm = re.exec(text)) !== null) found.push({ index: mm.index, data: fn(mm) }); }\n  collect(/(Punta|Valle)\\s+([\\d.,]+)\\s*kW\\s*x\\s*(\\d+)\\s*d[ií]as\\s*x\\s*([\\d.,]+)\\s*€\\s*\\/\\s*kW\\s*d[ií]a/gi, function (mm) {\n    var qty = esNum(mm[2]), days = parseInt(mm[3], 10), price = esNum(mm[4]);\n    return { group: \"power\", line_type: \"potencia_\" + mm[1].toLowerCase(), tramo: mm[1].toLowerCase(), concept: \"Potencia \" + mm[1].toLowerCase(), detail: mm[0].trim(), quantity: qty, unit: \"kW\", unit_price: price, days: days, amount: round2(qty * days * price) };\n  });\n  collect(/([\\d.,]+)\\s*kWh\\s*x\\s*([\\d.,]+)\\s*€\\s*\\/\\s*kWh/gi, function (mm) {\n    var qty = esNum(mm[1]), price = esNum(mm[2]);\n    var isFnee = price != null && price < 0.01;\n    var line = { group: \"energy\", line_type: isFnee ? \"energia_fnee\" : \"energia\", tramo: null, concept: isFnee ? \"Regularización FNEE\" : \"Energía consumida\", detail: mm[0].trim(), quantity: qty, unit: \"kWh\", unit_price: price, amount: round2(qty * price) };\n    energyMatches.push(line);\n    return line;\n  });\n  var dayLines = [];\n  collect(/(\\d+)\\s*d[ií]as\\s*x\\s*([\\d.,]+)\\s*€\\s*\\/\\s*d[ií]a/gi, function (mm) {\n    var days = parseInt(mm[1], 10), price = esNum(mm[2]);\n    var line = { group: \"charges\", line_type: \"bono_social\", concept: \"Financiación bono social fijo\", detail: mm[0].trim(), quantity: days, unit: \"días\", unit_price: price, days: days, amount: round2(days * price) };\n    dayLines.push(line);\n    return line;\n  });\n  collect(/([\\d.,]+)\\s*mes(?:es)?\\s*x\\s*([\\d.,]+)\\s*€\\s*\\/\\s*mes/gi, function (mm) {\n    var qty = esNum(mm[1]), price = esNum(mm[2]);\n    return { group: \"services\", line_type: \"proteccion_hogar\", concept: \"Protección Eléctrica Hogar\", detail: mm[0].trim(), quantity: qty, unit: \"meses\", unit_price: price, amount: round2(qty * price) };\n  });\n  collect(/([\\d.,]+)\\s*%\\s*s\\s*\\/\\s*([\\d.,]+)\\s*€/gi, function (mm) {\n    var rate = esNum(mm[1]), base = esNum(mm[2]);\n    var isIva = rate != null && rate > 7;\n    return { group: \"taxes\", line_type: isIva ? \"iva\" : \"impuesto_electricidad\", concept: isIva ? \"IVA\" : \"Impuesto sobre electricidad\", detail: mm[0].trim(), unit: \"%\", unit_price: null, vat_rate: rate, tax_base: base, amount: round2((rate / 100) * base) };\n  });\n  for (var d = 0; d < dayLines.length; d++) {\n    if (d === 1) { dayLines[d].group = \"services\"; dayLines[d].line_type = \"alquiler_contador\"; dayLines[d].concept = \"Alquiler equipos medida\"; }\n  }\n  found.sort(function (a, b) { return a.index - b.index; });\n  var lines = found.map(function (f, i) { var o = f.data; o.line_no = i + 1; return o; });\n  if (t.consumption_kwh == null && energyMatches.length) {\n    var s = 0;\n    for (var e = 0; e < energyMatches.length; e++) s += (energyMatches[e].quantity || 0);\n    t.consumption_kwh = round2(s);\n  }\n  t.lines = lines;\n  return { header: t, lines: lines, consumption: consumption };\n}\n\n\nvar base = \"https://insforge.benicolo.com\"; var bucket = \"iberdrola\";\nvar out = []; var all = $input.all();\nfor (var idx = 0; idx < all.length; idx++) {\n  var item = all[idx]; var j = item.json || {};\n  var text = j.text || j.data || j.content || \"\";\n  var r = parseIberdrola(text); var h = r.header;\n  if (!h.invoice_number) continue;\n  var messageId = j.messageId || j.id || null;\n  var key = \"iberdrola/\" + (h.contract_number || \"unknown\") + \"/\" + (h.invoice_number || messageId || \"factura\") + \".pdf\";\n  var payload = {\n    p_invoice: {\n      message_id: messageId,\n      contract_number: h.contract_number || null,\n      contract_label: h.contract_label || null,\n      invoice_number: h.invoice_number || null,\n      issue_date: h.issue_date || null,\n      period_start: h.period_start || null,\n      period_end: h.period_end || null,\n      due_date: h.due_date || null,\n      tariff: h.tariff || null,\n      days_billed: (h.days_billed == null ? null : String(h.days_billed)),\n      total: h.total,\n      subtotal: h.subtotal,\n      energy_amount: h.energy_amount,\n      charges_amount: h.charges_amount,\n      services_amount: h.services_amount,\n      tax_amount: h.tax_amount,\n      consumption_kwh: h.consumption_kwh,\n      cups: h.cups || null,\n      supply_address: h.supply_address || null,\n      city: h.city || null,\n      titular: h.titular || null,\n      nif: h.nif || null,\n      contracted_power_punta: h.contracted_power_punta,\n      contracted_power_valle: h.contracted_power_valle,\n      pdf_key: key,\n      pdf_url: base + \"/api/storage/buckets/\" + bucket + \"/objects/\" + encodeURIComponent(key),\n      raw_text: h.raw_text\n    },\n    p_lines: r.lines,\n    p_consumption: r.consumption\n  };\n  out.push({ json: { message_id: messageId, key: key, invoice_number: h.invoice_number, contract_number: h.contract_number, total: h.total, lines_count: r.lines.length, payload: payload }, binary: item.binary });\n}\nreturn out;\n" },
    position: [1520, 400]
  },
  output: [{ message_id: '18f0000000000000', key: 'iberdrola/279914829/21240222010006319.pdf', lines_count: 9 }]
});

const notInDb = node({
  type: 'n8n-nodes-base.filter',
  version: 2.2,
  config: {
    name: 'Not In DB',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [
          {
            leftValue: "={{ !($('List Existing Message Ids').first().json.ids || []).includes($json.message_id) }}",
            rightValue: true,
            operator: { type: 'boolean', operation: 'true', singleValue: true }
          }
        ],
        combinator: 'and'
      },
      options: {}
    },
    position: [1740, 400]
  },
  output: [{ message_id: '18f0000000000000' }]
});

const dbUpsert = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'DB Upsert Invoice',
    parameters: {
      method: 'POST',
      url: INS_FORGE_BASE + '/api/database/rpc/iberdrola_upsert_invoice',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json.payload) }}',
      options: {}
    },
    credentials: { httpHeaderAuth: newCredential('InsForge') },
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    position: [1960, 400]
  },
  output: [{ id: '00000000-0000-0000-0000-000000000000', invoice_number: '21240222010006319' }]
});

const reattach = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Reattach PDF',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "var parsed = $('Parse Iberdrola').all();\nvar byInv = {};\nfor (var i = 0; i < parsed.length; i++) { var pj = parsed[i].json || {}; if (pj.invoice_number) byInv[pj.invoice_number] = parsed[i]; }\nvar resp = $input.all(); var out = [];\nfor (var r = 0; r < resp.length; r++) {\n  var j = resp[r].json || {};\n  var src = byInv[j.invoice_number];\n  out.push({ json: { invoice_id: j.id || null, key: src ? (src.json.key || null) : null }, binary: src ? src.binary : undefined });\n}\nreturn out;" },
    position: [2180, 400]
  },
  output: [{ invoice_id: '00000000-0000-0000-0000-000000000000', key: 'iberdrola/279914829/21240222010006319.pdf' }]
});

const notInStorage = node({
  type: 'n8n-nodes-base.filter',
  version: 2.2,
  config: {
    name: 'Not In Storage',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [
          {
            leftValue: "={{ !($('List Existing Objects').first().json.data || []).some(o => o.key === $json.key) }}",
            rightValue: true,
            operator: { type: 'boolean', operation: 'true', singleValue: true }
          }
        ],
        combinator: 'and'
      },
      options: {}
    },
    position: [2400, 400]
  },
  output: [{ key: 'iberdrola/279914829/21240222010006319.pdf' }]
});

const uploadPdf = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Upload to InsForge',
    parameters: {
      method: 'PUT',
      url: '=' + INS_FORGE_BASE + '/api/storage/buckets/' + BUCKET + '/objects/{{ encodeURIComponent($json.key) }}',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      contentType: 'multipart-form-data',
      bodyParameters: { parameters: [{ parameterType: 'formBinaryData', name: 'file', inputDataFieldName: 'data' }] },
      options: {}
    },
    credentials: { httpHeaderAuth: newCredential('InsForge') },
    retryOnFail: true,
    maxTries: 4,
    waitBetweenTries: 3000,
    onError: 'continueRegularOutput',
    position: [2620, 400]
  },
  output: [{ key: 'iberdrola/279914829/21240222010006319.pdf' }]
});

export default workflow('iberdrola-invoices-backfill', 'Iberdrola Invoices Backfill')
  .add(startTrigger)
  .to(listMessageIds)
  .to(listObjects)
  .to(getInvoices)
  .to(expandPdfs)
  .to(extractPdf)
  .to(parseInvoice)
  .to(notInDb)
  .to(dbUpsert)
  .to(reattach)
  .to(notInStorage)
  .to(uploadPdf);
