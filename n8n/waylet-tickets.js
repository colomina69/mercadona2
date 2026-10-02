import { workflow, node, trigger, newCredential } from '@n8n/workflow-sdk';

const INS_FORGE_BASE = 'https://insforge.benicolo.com';
const BUCKET = 'waylet';

const gmailTrigger = trigger({
  type: 'n8n-nodes-base.gmailTrigger',
  version: 1.3,
  config: {
    name: 'New Waylet Ticket',
    parameters: {
      pollTimes: { item: [{ mode: 'everyMinute' }] },
      event: 'messageReceived',
      simple: false,
      filters: {
        q: 'from:benicolo@gmail.com subject:Waylet',
        readStatus: 'both'
      },
      options: {}
    },
    credentials: { gmailOAuth2: newCredential('Gmail account') },
    position: [220, 300]
  },
  output: [{ id: '18f0000000000000', subject: 'Waylet - ES GLEM S.L COCENTAINA', text: '...' }]
});

const extractLink = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Extract link',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "var out = [];\nvar items = $input.all();\nfor (var i = 0; i < items.length; i++) {\n  var j = items[i].json || {};\n  var body = String(j.html || j.text || j.body || \"\");\n  var m = body.match(/https:\\/\\/waylet\\.repsol\\.everiscloudpayments\\.com\\/waylet\\/api\\/public\\/klikin\\/ticket-services\\/v1\\/ticket\\/[A-Za-z0-9]+/);\n  if (!m) continue;\n  var subject = j.subject || (j.headers && j.headers.subject) || \"\";\n  var lm = String(subject).match(/Waylet\\s*-\\s*ES GLEM S\\.?L\\.?\\s+(.+)$/i);\n  out.push({ json: { messageId: j.id || null, subject: subject, locality: lm ? lm[1].trim() : null, url: m[0] } });\n}\nreturn out;" },
    position: [460, 300]
  },
  output: [{ messageId: '18f0000000000000', locality: 'COCENTAINA', url: 'https://waylet.repsol.everiscloudpayments.com/...' }]
});

const downloadPdf = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Download PDF',
    parameters: {
      method: 'GET',
      url: '={{ $json.url }}',
      options: {
        response: { response: { responseFormat: 'file', outputPropertyName: 'data' } },
        redirect: { redirect: { followRedirects: true, maxRedirects: 5 } }
      }
    },
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    onError: 'continueRegularOutput',
    position: [700, 300]
  },
  output: [{ data: {} }]
});

const extractPdf = node({
  type: 'n8n-nodes-base.extractFromFile',
  version: 1.1,
  config: {
    name: 'Extract PDF Text',
    parameters: { operation: 'pdf', binaryPropertyName: 'data', options: { keepSource: 'both' } },
    onError: 'continueRegularOutput',
    position: [940, 300]
  },
  output: [{ text: 'ES GLEM SL ...' }]
});

const parseWaylet = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse Waylet',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "function norm(s) {\n  return String(s == null ? \"\" : s).replace(/\\uFB01/g, \"fi\").replace(/\\uFB02/g, \"fl\");\n}\nfunction esNum(s) {\n  if (s == null) return null;\n  var v = String(s).trim().replace(/\\s/g, \"\").replace(/€/g, \"\");\n  if (!v) return null;\n  if (v.indexOf(\",\") >= 0) v = v.replace(/\\./g, \"\").replace(\",\", \".\");\n  var n = parseFloat(v);\n  return isNaN(n) ? null : n;\n}\n\nfunction parseWaylet(rawText) {\n  var text = norm(rawText);\n  var t = { raw_text: text };\n  var m;\n  var discountLabel = null;\n\n  // Station + address + postal code / locality\n  m = text.match(/(ES\\s+GLEM\\s+S\\.?L\\.?)/i);\n  if (m) t.station_name = m[1].replace(/\\s+/g, \" \").trim();\n  else {\n    m = text.match(/(GLEM\\s+S\\.?L\\.?)/i);\n    if (m) t.station_name = m[1].trim();\n  }\n  m = text.match(/(C\\/|CL)\\s+[^\\n]+/);\n  if (m) t.address = m[0].trim();\n  m = text.match(/(\\d{5})\\s*-\\s*([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑ ]+)/);\n  if (m) {\n    t.postal_code = m[1];\n    t.locality = m[2].trim();\n  }\n\n  // Date + time\n  m = text.match(/Fecha:\\s*(\\d{2})-(\\d{2})-(\\d{4})/);\n  var fecha = m ? m[3] + \"-\" + m[2] + \"-\" + m[1] : null;\n  m = text.match(/Hora:\\s*(\\d{2}:\\d{2}(?::\\d{2})?)/);\n  var hora = m ? m[1] : null;\n  t.purchased_at = fecha ? fecha + \"T\" + (hora ? (hora.length === 5 ? hora + \":00\" : hora) : \"00:00:00\") : null;\n\n  // Product table.\n  // Layout A (n8n Extract): columns preserved on one header line\n  //   PRODUCTO €/L LITROS IMPORTE\n  //   Diesel e+ 1,939 25,78 49,99\n  m = text.match(/PRODUCTO\\s+€\\/L\\s+LITROS\\s+IMPORTE\\s*\\n\\s*([^\\n]+?)\\s+(-?[\\d.,]+)\\s+(-?[\\d.,]+)\\s+(-?[\\d.,]+)/i);\n  if (m) {\n    t.fuel_type = m[1].trim();\n    t.unit_price = esNum(m[2]);\n    t.liters = esNum(m[3]);\n    t.gross_amount = esNum(m[4]);\n    var rest = text.slice(m.index + m[0].length);\n    var dm = rest.match(/\\n\\s*([^\\n]+?)\\s+(-[\\d.,]+)\\s*\\n/);\n    if (dm && !/Total/i.test(dm[1])) discountLabel = dm[1].trim();\n    if (dm && !/Total/i.test(dm[1])) t.discount_amount = Math.abs(esNum(dm[2]));\n  } else {\n    // Layout B (pdftotext): columns stacked\n    m = text.match(/PRODUCTO\\s*€\\/L\\s*([^\\n]+)\\s+([\\d.,]+)/i);\n    if (m) {\n      t.fuel_type = m[1].trim();\n      t.unit_price = esNum(m[2]);\n    }\n    m = text.match(/LITROS\\s*([\\d.,]+)/i);\n    if (m) t.liters = esNum(m[1]);\n    m = text.match(/([^\\n]+)\\n\\s*LITROS/i);\n    if (m && m[1] && !/^[\\d.,\\s]+$/.test(m[1])) discountLabel = m[1].trim();\n    m = text.match(/IMPORTE\\s+(-?[\\d.,]+)\\s+(-?[\\d.,]+)/i);\n    if (m) {\n      t.gross_amount = esNum(m[1]);\n      t.discount_amount = Math.abs(esNum(m[2]));\n    }\n  }\n\n  // Totals\n  m = text.match(/Total descuento:\\s*([\\d.,]+)\\s*€/i);\n  if (m && (t.discount_amount == null || t.discount_amount === 0)) t.discount_amount = Math.abs(esNum(m[1]));\n  m = text.match(/Total Venta:\\s*([\\d.,]+)\\s*€/i);\n  if (m) t.total = esNum(m[1]);\n  if (t.total == null) {\n    m = text.match(/Total tarjeta:\\s*([\\d.,]+)\\s*€/i);\n    if (m) t.total = esNum(m[1]);\n  }\n\n  // Payment\n  m = text.match(/Pago Waylet\\s+(.+?)\\s*\\*+(\\d{4})/i);\n  if (m) {\n    t.payment_method = m[1].replace(/\\s+/g, \" \").trim();\n    t.card_last4 = m[2];\n  }\n\n  // Ticket number + waylet id\n  m = text.match(/N\\.?\\s*de ticket\\s*(\\d+)/i);\n  if (m) t.ticket_number = m[1];\n  m = text.match(/Id:\\s*([0-9a-fA-F-]{36})/);\n  if (m) t.waylet_id = m[1];\n\n  // Lines (primary fuel + discount / other products)\n  var lines = [];\n  if (t.fuel_type || t.gross_amount != null) {\n    lines.push({ product_name: t.fuel_type || \"Combustible\", unit_price: t.unit_price, amount: t.gross_amount });\n  }\n  if (t.discount_amount != null && t.discount_amount > 0) {\n    lines.push({ product_name: discountLabel || \"Descuento\", unit_price: null, amount: -t.discount_amount });\n  }\n\n  return { header: t, lines: lines };\n}\n\n\nvar base = \"https://insforge.benicolo.com\"; var bucket = \"waylet\";\nvar meta = $('Extract link').all();\nvar items = $input.all(); var out = [];\nfor (var i = 0; i < items.length; i++) {\n  var item = items[i]; var j = item.json || {};\n  var text = j.text || j.data || \"\";\n  var r = parseWaylet(text); var h = r.header;\n  if (!h.ticket_number) continue;\n  var mi = meta[i] ? (meta[i].json || {}) : {};\n  var messageId = mi.messageId || j.id || null;\n  var locality = h.locality || mi.locality || null;\n  var key = \"waylet/\" + (h.ticket_number || messageId || \"ticket\") + \".pdf\";\n  var payload = {\n    p_ticket: {\n      message_id: messageId,\n      waylet_id: h.waylet_id || null,\n      ticket_number: h.ticket_number,\n      purchased_at: h.purchased_at || null,\n      station_name: h.station_name || null,\n      address: h.address || null,\n      postal_code: h.postal_code || null,\n      locality: locality,\n      fuel_type: h.fuel_type || null,\n      liters: h.liters,\n      unit_price: h.unit_price,\n      gross_amount: h.gross_amount,\n      discount_amount: h.discount_amount,\n      total: h.total,\n      payment_method: h.payment_method || null,\n      card_last4: h.card_last4 || null,\n      vehicle_plate: h.vehicle_plate || null,\n      points: h.points,\n      pdf_key: key,\n      pdf_url: base + \"/api/storage/buckets/\" + bucket + \"/objects/\" + encodeURIComponent(key),\n      raw_text: h.raw_text\n    },\n    p_lines: r.lines\n  };\n  out.push({ json: { message_id: messageId, key: key, ticket_number: h.ticket_number, locality: locality, payload: payload }, binary: item.binary });\n}\nreturn out;\n" },
    position: [1180, 300]
  },
  output: [{ ticket_number: '262400250757', key: 'waylet/262400250757.pdf' }]
});

const dbUpsert = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'DB Upsert Ticket',
    parameters: {
      method: 'POST',
      url: INS_FORGE_BASE + '/api/database/rpc/waylet_upsert_ticket',
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
    position: [1420, 300]
  },
  output: [{ id: '00000000-0000-0000-0000-000000000000', ticket_number: '262400250757' }]
});

const reattach = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Reattach PDF',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "var parsed = $('Parse Waylet').all();\nvar byTicket = {};\nfor (var i = 0; i < parsed.length; i++) { var pj = parsed[i].json || {}; if (pj.ticket_number) byTicket[pj.ticket_number] = parsed[i]; }\nvar resp = $input.all(); var out = [];\nfor (var r = 0; r < resp.length; r++) {\n  var j = resp[r].json || {};\n  var src = byTicket[j.ticket_number];\n  out.push({ json: { ticket_id: j.id || null, key: src ? (src.json.key || null) : null }, binary: src ? src.binary : undefined });\n}\nreturn out;" },
    position: [1660, 300]
  },
  output: [{ ticket_id: '00000000-0000-0000-0000-000000000000', key: 'waylet/262400250757.pdf' }]
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
    position: [1900, 300]
  },
  output: [{ key: 'waylet/262400250757.pdf' }]
});

export default workflow('waylet-tickets-to-insforge', 'Waylet Tickets to InsForge')
  .add(gmailTrigger)
  .to(extractLink)
  .to(downloadPdf)
  .to(extractPdf)
  .to(parseWaylet)
  .to(dbUpsert)
  .to(reattach)
  .to(uploadPdf);
