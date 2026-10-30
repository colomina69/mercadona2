import { workflow, node, trigger, newCredential, ifElse, switchCase } from '@n8n/workflow-sdk';

// ============================================================================
// WORKFLOW ÚNICO DE INGESTA — generado por scripts/n8n-ingesta-build.js
// No editar a mano: modifica los workflows fuente o este generador y regenera.
// ============================================================================

const INS_FORGE_HEADERS = { parameters: [{ name: 'Authorization', value: 'Bearer ik_06af335eeadbdfe2f6c12fa82c1d152c512a516af32ba808a37bfbfdb6ee0900' }] };

const gmailTrigger = trigger({
  type: 'n8n-nodes-base.gmailTrigger',
  version: 1.3,
  config: {
    name: 'Gmail — Ingesta',
    parameters: {
      pollTimes: { item: [{ mode: 'everyMinute' }] },
      event: 'messageReceived',
      simple: false,
      filters: {
        q: '(from:ticket_digital@mail.mercadona.com has:attachment filename:pdf) OR (from:clientes@clientesiberdrola.es has:attachment filename:pdf) OR (from:benicolo@gmail.com subject:Waylet) OR (from:maque@alberosl.com has:attachment filename:pdf)',
        readStatus: 'both'
      },
      options: {
        downloadAttachments: true,
        dataPropertyAttachmentsPrefixName: 'attachment_'
      }
    },
    credentials: { gmailOAuth2: newCredential('Gmail account') },
    position: [200, 100]
  },
  output: [{ id: '18f0000000000000', from: 'Mercadona <ticket_digital@mail.mercadona.com>', subject: 'Tu ticket Mercadona', text: '...' }]
});

const routeEmail = switchCase({
  version: 3.2,
  config: {
    name: 'Ruta por remitente',
    parameters: {
      mode: 'rules',
      rules: {
        values: [
          {"conditions":{"options":{"caseSensitive":false,"leftValue":"","typeValidation":"loose","version":2},"conditions":[{"leftValue":"={{ $json.from }}","rightValue":"ticket_digital@mail.mercadona.com","operator":{"type":"string","operation":"contains"}}],"combinator":"and"},"renameOutput":true,"outputKey":"ticket_digital@mail.mercadona.com"},
          {"conditions":{"options":{"caseSensitive":false,"leftValue":"","typeValidation":"loose","version":2},"conditions":[{"leftValue":"={{ $json.from }}","rightValue":"clientesiberdrola.es","operator":{"type":"string","operation":"contains"}}],"combinator":"and"},"renameOutput":true,"outputKey":"clientesiberdrola.es"},
          {"conditions":{"options":{"caseSensitive":false,"leftValue":"","typeValidation":"loose","version":2},"conditions":[{"leftValue":"={{ $json.from }}","rightValue":"benicolo@gmail.com","operator":{"type":"string","operation":"contains"}},{"leftValue":"={{ $json.subject }}","rightValue":"Waylet","operator":{"type":"string","operation":"contains"}}],"combinator":"and"},"renameOutput":true,"outputKey":"benicolo@gmail.com"},
          {"conditions":{"options":{"caseSensitive":false,"leftValue":"","typeValidation":"loose","version":2},"conditions":[{"leftValue":"={{ $json.from }}","rightValue":"alberosl.com","operator":{"type":"string","operation":"contains"}}],"combinator":"and"},"renameOutput":true,"outputKey":"alberosl.com"}
        ]
      },
      options: { fallbackOutput: 'none' }
    },
    position: [460, 100]
  },
  output: [{ from: 'Mercadona <ticket_digital@mail.mercadona.com>', subject: 'Tu ticket Mercadona' }]
});

const merc_INS_FORGE_BASE = 'https://insforge.benicolo.com';
const merc_BUCKET = 'mercadona';

const merc_gmailTrigger = trigger({
  type: 'n8n-nodes-base.merc_gmailTrigger',
  version: 1.3,
  config: {
    name: 'merc – New Mercadona Ticket',
    parameters: {
      pollTimes: { item: [{ mode: 'everyMinute' }] },
      event: 'messageReceived',
      simple: false,
      filters: {
        q: 'from:ticket_digital@mail.mercadona.com has:attachment filename:pdf',
        readStatus: 'both'
      },
      options: {
        downloadAttachments: true,
        dataPropertyAttachmentsPrefixName: 'attachment_'
      }
    },
    credentials: { gmailOAuth2: newCredential('Gmail account') },
    position: [220, 300]
  },
  output: [{ id: '18f0000000000000', subject: 'Tu ticket Mercadona' }]
});

const merc_expandPdfs = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'merc – Expand PDFs',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const out = [];
for (const item of $input.all()) {
  const bin = item.binary || {};
  const id = (item.json && item.json.id) ? item.json.id : "unknown";
  for (const prop of Object.keys(bin)) {
    const meta = bin[prop];
    if (prop.indexOf("attachment_") === 0 && meta && meta.mimeType === "application/pdf") {
      const name = meta.fileName ? meta.fileName : (prop + ".pdf");
      const safeName = String(name).replace(/[^A-Za-z0-9._-]+/g, "_");
      out.push({
        json: {
          messageId: id,
          key: "mercadona/" + id + "/" + safeName,
          filename: name,
          mimeType: meta.mimeType,
          size: meta.fileSize || 0
        },
        binary: { data: bin[prop] }
      });
    }
  }
}
return out;`
    },
    position: [460, 300]
  },
  output: [{ key: 'mercadona/18f0000000000000/ticket.pdf', messageId: '18f0000000000000' }]
});

const merc_extractPdf = node({
  type: 'n8n-nodes-base.extractFromFile',
  version: 1.1,
  config: {
    name: 'merc – Extract PDF Text',
    parameters: {
      operation: 'pdf',
      binaryPropertyName: 'data',
      options: { keepSource: 'both' }
    },
    position: [700, 300]
  },
  output: [{ text: 'MERCADONA, S.A. ...' }]
});

const merc_parseTicket = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'merc – Parse Ticket',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `function num(s) {
  if (s === null || s === undefined) return null;
  var v = String(s).trim();
  if (!v) return null;
  if (v.indexOf(".") >= 0 && v.indexOf(",") >= 0) v = v.replace(/\\./g, "").replace(",", ".");
  else v = v.replace(",", ".");
  var n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function merc_parseTicket(raw) {
  var text = String(raw === null || raw === undefined ? "" : raw);
  var t = { raw_text: text };
  var m;
  m = text.match(/FACTURA\\s+SIMPLIFICADA\\s*:\\s*([^\\n]+)/i);
  if (m) t.ticket_number = m[1].trim();
  m = text.match(/(\\d{2})\\/(\\d{2})\\/(\\d{4})\\s+(\\d{1,2}:\\d{2})/);
  if (m) t.purchased_at = m[3] + "-" + m[2] + "-" + m[1] + "T" + m[4] + ":00";
  m = text.match(/\\bOP\\s*:\\s*(\\d+)/i);
  if (m) t.operator_code = m[1];
  m = text.match(/\\b([A-Z]-\\d{8})\\b/);
  if (m) t.store_cif = m[1];
  m = text.match(/TEL[^\\n:]*:\\s*([\\d ]+)/i);
  if (m) t.store_phone = m[1].replace(/\\s+/g, "");
  var lines = text.replace(/\\r/g, "").split("\\n");
  var first = "";
  for (var j = 0; j < lines.length; j++) { if (lines[j].trim()) { first = lines[j].trim(); break; } }
  m = first.match(/^(.*?)\\s+([A-Z]-\\d{8})\\s*$/);
  if (m) { t.store_name = m[1].trim(); t.store_cif = t.store_cif || m[2]; } else { t.store_name = first; }
  var pcIdx = -1;
  for (var k = 0; k < lines.length; k++) { if (/^\\s*\\d{5}\\s+\\S/.test(lines[k])) { pcIdx = k; break; } }
  if (pcIdx >= 0) {
    m = lines[pcIdx].match(/^\\s*(\\d{5})\\s+(.+?)\\s*$/);
    if (m) { t.store_postal_code = m[1]; t.store_city = m[2]; }
    if (pcIdx > 0) t.store_address = lines[pcIdx - 1].trim();
  }
  m = text.match(/ENTRADA\\s+(\\d{1,2}:\\d{2})\\s+SALIDA\\s+(\\d{1,2}:\\d{2})/i);
  if (m) { t.entry_time = m[1]; t.exit_time = m[2]; }
  m = text.match(/^\\s*TOTAL\\s*(?:\\([^\\n]*\\))?\\s*([\\d.,]+)\\s*$/im);
  if (m) t.total = num(m[1]);
  m = text.match(/\\b(TARJETA BANCARIA|EFECTIVO|VISA|MASTERCARD|MET[\\u00C1A]LICO)\\b/i);
  if (m) t.payment_method = m[1].toUpperCase();
  m = text.match(/\\*{3,}\\s*\\*{3,}\\s*\\*{3,}\\s*(\\d{4})/);
  if (m) t.card_last4 = m[1];
  m = text.match(/N\\.?\\s*C\\s*:\\s*([A-Za-z0-9\\-]+)/i);
  if (m) t.nc = m[1];
  m = text.match(/AUT\\s*:\\s*([A-Za-z0-9\\-]+)/i);
  if (m) t.auth_code = m[1];
  var vats = [];
  var ivaStart = -1;
  for (var q = 0; q < lines.length; q++) {
    var lq = lines[q].trim();
    if (/^IVA\\b/i.test(lq) || /BASE\\s+IMPONIBLE/i.test(lq)) { ivaStart = q; break; }
  }
  if (ivaStart >= 0) {
    for (var r = ivaStart + 1; r < lines.length; r++) {
      var lv = lines[r].trim();
      if (!lv) continue;
      if (/^TOTAL\\b/i.test(lv)) break;
      var mm = lv.match(/^(\\d{1,2})\\s*%\\s+([\\d.,]+)\\s+([\\d.,]+)(?:\\s+([\\d.,]+))?\\s*$/);
      if (mm) vats.push({ rate: parseInt(mm[1], 10), base: num(mm[2]), amount: num(mm[3]) });
      else if (!/^\\d/.test(lv)) break;
    }
  }
  if (vats.length) {
    t.vat_summary = vats;
    var sbase = 0;
    for (var v = 0; v < vats.length; v++) sbase += (vats[v].base || 0);
    t.subtotal = Math.round(sbase * 100) / 100;
  }
  var items = [];
  var start = -1;
  for (var p = 0; p < lines.length; p++) { if (/Descripci[o\\u00F3]n.*(P\\.?\\s*Unit|Importe)/i.test(lines[p])) { start = p; break; } }
  for (var i = (start >= 0 ? start + 1 : 0); i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    if (/^(ENTRADA|TOTAL|TARJETA|TARJ\\.|IVA|N\\.?\\s*C\\s*:|AID:|SE ADMITEN|DISPONE|PARA RETIRAR|Importe:)/i.test(line)) break;
    var tokens = line.split(/\\s+/);
    var qty = num(tokens[0]);
    if (qty === null) continue;
    var nums = [];
    var kk = tokens.length - 1;
    while (kk >= 1 && /^\\d+([.,]\\d+)?$/.test(tokens[kk])) { nums.unshift(tokens[kk]); kk--; }
    if (!nums.length) {
      var nameOnly = tokens.slice(1).join(" ").trim();
      var nl = (lines[i + 1] || "").trim();
      var wm2 = nl.match(/^([\\d.,]+)\\s*(kg|g)\\s+([\\d.,]+)\\s*\\u20AC?\\s*\\/\\s*(kg|g)\\s+([\\d.,]+)\\s*$/i);
      if (wm2) {
        var wq = num(wm2[1]);
        items.push({ line_no: items.length + 1, product_name: nameOnly, quantity: wq, unit: wm2[2].toLowerCase(), unit_price: num(wm2[3]), weight_kg: wq, amount: num(wm2[5]) });
        i = i + 1;
      }
      continue;
    }
    var amount = num(nums[nums.length - 1]);
    var unitPrice = null;
    var consume = 1;
    if (nums.length >= 2 && qty !== 1) {
      var cand = num(nums[nums.length - 2]);
      if (cand !== null && Math.abs(cand * qty - amount) < 0.02) { unitPrice = cand; consume = 2; }
    }
    var nameEnd = tokens.length - consume;
    var name = tokens.slice(1, nameEnd).join(" ").trim();
    var unit = "ud";
    var weight = null;
    for (var u = 0; u < tokens.length; u++) {
      if (/^kg$/i.test(tokens[u]) || /^g$/i.test(tokens[u])) {
        unit = tokens[u].toLowerCase();
        if (u > 0 && /^\\d+([.,]\\d+)?$/.test(tokens[u - 1])) weight = num(tokens[u - 1]);
        break;
      }
    }
    items.push({ line_no: items.length + 1, product_name: name, quantity: qty, unit: unit, unit_price: unitPrice, weight_kg: weight, amount: amount });
  }
  t.items = items;
  t.item_count = items.length;
  return t;
}

var base = "https://insforge.benicolo.com";
var bucket = "mercadona";
var out = [];
var all = $input.all();
for (var idx = 0; idx < all.length; idx++) {
  var item = all[idx];
  var j = item.json || {};
  var text = j.text || j.data || j.content || "";
  var t = merc_parseTicket(text);
  var messageId = j.messageId || j.id || null;
  var key = j.key || null;
  var payload = {
    p_ticket: {
      message_id: messageId,
      ticket_number: t.ticket_number || null,
      purchased_at: t.purchased_at || null,
      store_name: t.store_name || null,
      store_cif: t.store_cif || null,
      store_address: t.store_address || null,
      store_postal_code: t.store_postal_code || null,
      store_city: t.store_city || null,
      store_phone: t.store_phone || null,
      operator_code: t.operator_code || null,
      entry_time: t.entry_time || null,
      exit_time: t.exit_time || null,
      item_count: t.item_count || null,
      subtotal: (t.subtotal === undefined ? null : t.subtotal),
      total: (t.total === undefined ? null : t.total),
      payment_method: t.payment_method || null,
      card_last4: t.card_last4 || null,
      nc: t.nc || null,
      auth_code: t.auth_code || null,
      vat_summary: t.vat_summary || null,
      pdf_key: key,
      pdf_url: key ? (base + "/api/storage/buckets/" + bucket + "/objects/" + encodeURIComponent(key)) : null,
      raw_text: t.raw_text
    },
    p_items: t.items
  };
  out.push({ json: { message_id: messageId, key: key, text_len: String(text).length, payload: payload }, binary: item.binary });
}
return out;`
    },
    position: [940, 300]
  },
  output: [{ message_id: '18f0000000000000', key: 'mercadona/18f0000000000000/ticket.pdf', text_len: 800 }]
});

const merc_dbUpsert = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'merc – DB Upsert Ticket',
    parameters: {
      method: 'POST',
      url: merc_INS_FORGE_BASE + '/api/database/rpc/mercadona_upsert_ticket',
      sendHeaders: true,
      headerParameters: INS_FORGE_HEADERS,
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json.payload) }}',
      options: {}
    },
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    position: [1180, 300]
  },
  output: [{ id: '00000000-0000-0000-0000-000000000000', message_id: '18f0000000000000' }]
});

const merc_reattach = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'merc – Reattach PDF',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `var parsed = $('merc – Parse Ticket').all();
var byId = {};
for (var i = 0; i < parsed.length; i++) {
  var pj = parsed[i].json || {};
  if (pj.message_id) byId[pj.message_id] = parsed[i];
}
var resp = $input.all();
var out = [];
for (var r = 0; r < resp.length; r++) {
  var j = resp[r].json || {};
  var src = byId[j.message_id];
  var key = j.pdf_key || (src && src.json ? src.json.key : null) || null;
  out.push({
    json: { message_id: j.message_id || null, ticket_id: j.id || null, key: key },
    binary: src ? src.binary : undefined
  });
}
return out;`
    },
    position: [1420, 300]
  },
  output: [{ message_id: '18f0000000000000', key: 'mercadona/18f0000000000000/ticket.pdf' }]
});

const merc_uploadPdf = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'merc – Upload to InsForge',
    parameters: {
      method: 'PUT',
      url: '=' + merc_INS_FORGE_BASE + '/api/storage/buckets/' + merc_BUCKET + '/objects/{{ encodeURIComponent($json.key) }}',
      sendHeaders: true,
      headerParameters: INS_FORGE_HEADERS,
      sendBody: true,
      contentType: 'multipart-form-data',
      bodyParameters: {
        parameters: [
          { parameterType: 'formBinaryData', name: 'file', inputDataFieldName: 'data' }
        ]
      },
      options: {}
    },
    retryOnFail: true,
    maxTries: 4,
    waitBetweenTries: 3000,
    onError: 'continueRegularOutput',
    position: [1660, 300]
  },
  output: [{ key: 'mercadona/18f0000000000000/ticket.pdf' }]
});

const ibe_INS_FORGE_BASE = 'https://insforge.benicolo.com';
const ibe_BUCKET = 'iberdrola';

const ibe_gmailTrigger = trigger({
  type: 'n8n-nodes-base.ibe_gmailTrigger',
  version: 1.3,
  config: {
    name: 'ibe – New Iberdrola Invoice',
    parameters: {
      pollTimes: { item: [{ mode: 'everyMinute' }] },
      event: 'messageReceived',
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
    position: [220, 1100]
  },
  output: [{ id: '18f0000000000000', subject: 'Tu factura de luz' }]
});

const ibe_expandPdfs = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'ibe – Expand PDFs',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: "const out = [];\nfor (const item of $input.all()) {\n  const bin = item.binary || {};\n  const id = (item.json && item.json.id) ? item.json.id : \"unknown\";\n  for (const prop of Object.keys(bin)) {\n    const meta = bin[prop];\n    if (prop.indexOf(\"attachment_\") === 0 && meta && meta.mimeType === \"application/pdf\") {\n      const name = meta.fileName ? meta.fileName : (prop + \".pdf\");\n      const safeName = String(name).replace(/[^A-Za-z0-9._-]+/g, \"_\");\n      out.push({\n        json: { messageId: id, filename: name, mimeType: meta.mimeType, size: meta.fileSize || 0, safeName: safeName },\n        binary: { data: bin[prop] }\n      });\n    }\n  }\n}\nreturn out;"
    },
    position: [460, 1100]
  },
  output: [{ messageId: '18f0000000000000', filename: 'factura.pdf', safeName: 'factura.pdf' }]
});

const ibe_extractPdf = node({
  type: 'n8n-nodes-base.extractFromFile',
  version: 1.1,
  config: {
    name: 'ibe – Extract PDF Text',
    parameters: {
      operation: 'pdf',
      binaryPropertyName: 'data',
      options: { keepSource: 'both' }
    },
    onError: 'continueRegularOutput',
    position: [700, 1100]
  },
  output: [{ text: 'FACTURA DE ELECTRICIDAD ...' }]
});

const ibe_parseInvoice = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'ibe – Parse Iberdrola',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: "function norm(s) {\n  return String(s == null ? \"\" : s).replace(/\\uFB01/g, \"fi\").replace(/\\uFB02/g, \"fl\");\n}\nfunction esNum(s) {\n  if (s == null) return null;\n  var v = String(s).trim().replace(/\\s/g, \"\");\n  if (!v) return null;\n  if (v.indexOf(\",\") >= 0) v = v.replace(/\\./g, \"\").replace(\",\", \".\");\n  var n = parseFloat(v);\n  return isNaN(n) ? null : n;\n}\nfunction pad(n) {\n  return String(n).padStart(2, \"0\");\n}\nfunction round2(n) {\n  return n == null ? null : Math.round(n * 100) / 100;\n}\nfunction isoDate(s) {\n  var m = String(s || \"\").trim().match(/^(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})$/);\n  return m ? m[3] + \"-\" + pad(m[2]) + \"-\" + pad(m[1]) : null;\n}\nvar MONTHS = {\n  enero: \"01\", febrero: \"02\", marzo: \"03\", abril: \"04\", mayo: \"05\", junio: \"06\",\n  julio: \"07\", agosto: \"08\", septiembre: \"09\", setiembre: \"09\", octubre: \"10\", noviembre: \"11\", diciembre: \"12\"\n};\nfunction isoLongDate(s) {\n  var m = String(s || \"\").trim().match(/^(\\d{1,2}) de ([a-z\\u00e1\\u00e9\\u00ed\\u00f3\\u00fa]+) de (\\d{4})$/i);\n  if (!m) return null;\n  var mo = MONTHS[m[2].toLowerCase()];\n  return mo ? m[3] + \"-\" + mo + \"-\" + pad(m[1]) : null;\n}\n\nfunction parseIberdrola(rawText) {\n  var text = norm(rawText);\n  var t = { raw_text: text };\n  var m;\n  m = text.match(/Nº FACTURA:\\s*(\\d{17})/); if (m) t.invoice_number = m[1];\n  m = text.match(/Nº DE CONTRATO:\\s*(\\d+)/); if (m) t.contract_number = m[1];\n  m = text.match(/PERIODO DE FACTURACIÓN:\\s*(\\d{2}\\/\\d{2}\\/\\d{4})\\s*-\\s*(\\d{2}\\/\\d{2}\\/\\d{4})/);\n  if (m) { t.period_start = isoDate(m[1]); t.period_end = isoDate(m[2]); }\n  m = text.match(/FECHA DE EMISIÓN:\\s*([^\\n]+)/); if (m) t.issue_date = isoLongDate(m[1]);\n  m = text.match(/FECHA PREVISTA DE COBRO:\\s*(\\d{2}\\/\\d{2}\\/\\d{4})/); if (m) t.due_date = isoDate(m[1]);\n  m = text.match(/DIAS FACTURADOS:\\s*(\\d+)/); if (m) t.days_billed = parseInt(m[1], 10);\n  m = text.match(/TOTAL\\s*\\n\\s*([\\d.]+,\\d{2})\\s*€/); if (m) t.total = esNum(m[1]);\n  m = text.match(/ENERGÍA\\.{3,}\\s*([\\d.]+,\\d{2})\\s*€/); if (m) t.energy_amount = esNum(m[1]);\n  m = text.match(/CARGOS NORMATIVOS\\s*\\.{3,}\\s*([\\d.]+,\\d{2})\\s*€/); if (m) t.charges_amount = esNum(m[1]);\n  m = text.match(/SERVICIOS Y OTROS CONCEPTOS\\.{3,}\\s*([\\d.]+,\\d{2})\\s*€/); if (m) t.services_amount = esNum(m[1]);\n  m = text.match(/IVA\\.{3,}\\s*([\\d.]+,\\d{2})\\s*€/); if (m) t.tax_amount = esNum(m[1]);\n  if (t.total != null && t.tax_amount != null) t.subtotal = round2(t.total - t.tax_amount);\n  m = text.match(/Potencia punta:\\s*([\\d.,]+)\\s*kW\\s*Potencia valle:\\s*([\\d.,]+)\\s*kW/i);\n  if (m) { t.contracted_power_punta = esNum(m[1]); t.contracted_power_valle = esNum(m[2]); }\n  m = text.match(/\\b(\\d\\.\\dTD)\\b/); if (m) t.tariff = m[1];\n  m = text.match(/\\b(\\d{8}[A-Z])\\b/); if (m) t.nif = m[1];\n  m = text.match(/(ES\\s?\\d{4}\\s?\\d{4}\\s?\\d{4}\\s?\\d{4}\\s?[A-Z]{2})/); if (m) t.cups = m[1].trim();\n  m = text.match(/Titular\\s*\\n\\s*([^\\n]+)/); if (m) t.titular = m[1].trim();\n  m = text.match(/Dirección de suministro:\\s*\\n?\\s*([^\\n]+)/i);\n  if (m) {\n    t.supply_address = m[1].trim();\n    var city = t.supply_address.match(/\\b(\\d{5})\\s+([A-Za-zÁÉÍÓÚÑáéíóúñ\\s]+?)\\s*\\(/);\n    if (city) t.city = city[1] + \" \" + city[2].trim();\n    var street = t.supply_address.match(/C\\/\\s*([^,]+)/i);\n    if (street) t.contract_label = street[1].trim();\n  }\n\n  var consumption = [];\n  m = text.match(/consumos desagregados han sido punta:?\\s*([\\d.,]+)\\s*kWh;?\\s*llano:?\\s*([\\d.,]+)\\s*kWh;?\\s*valle:?\\s*([\\d.,]+)\\s*kWh/i);\n  if (m) {\n    consumption.push({ tramo: \"punta\", kwh: esNum(m[1]) }, { tramo: \"llano\", kwh: esNum(m[2]) }, { tramo: \"valle\", kwh: esNum(m[3]) });\n    t.consumption_kwh = round2((esNum(m[1]) || 0) + (esNum(m[2]) || 0) + (esNum(m[3]) || 0));\n  } else {\n    var g = text.match(/([\\d.,]+)\\s*kWh\\s*\\n\\s*[\\d.,]+\\s*€[\\s\\S]{0,40}?Consumo total/i);\n    if (g) t.consumption_kwh = esNum(g[1]);\n  }\n\n  var found = [];\n  var energyMatches = [];\n  function collect(re, fn) { var mm; while ((mm = re.exec(text)) !== null) found.push({ index: mm.index, data: fn(mm) }); }\n  collect(/(Punta|Valle)\\s+([\\d.,]+)\\s*kW\\s*x\\s*(\\d+)\\s*d[ií]as\\s*x\\s*([\\d.,]+)\\s*€\\s*\\/\\s*kW\\s*d[ií]a/gi, function (mm) {\n    var qty = esNum(mm[2]), days = parseInt(mm[3], 10), price = esNum(mm[4]);\n    return { group: \"power\", line_type: \"potencia_\" + mm[1].toLowerCase(), tramo: mm[1].toLowerCase(), concept: \"Potencia \" + mm[1].toLowerCase(), detail: mm[0].trim(), quantity: qty, unit: \"kW\", unit_price: price, days: days, amount: round2(qty * days * price) };\n  });\n  collect(/([\\d.,]+)\\s*kWh\\s*x\\s*([\\d.,]+)\\s*€\\s*\\/\\s*kWh/gi, function (mm) {\n    var qty = esNum(mm[1]), price = esNum(mm[2]);\n    var isFnee = price != null && price < 0.01;\n    var line = { group: \"energy\", line_type: isFnee ? \"energia_fnee\" : \"energia\", tramo: null, concept: isFnee ? \"Regularización FNEE\" : \"Energía consumida\", detail: mm[0].trim(), quantity: qty, unit: \"kWh\", unit_price: price, amount: round2(qty * price) };\n    energyMatches.push(line);\n    return line;\n  });\n  var dayLines = [];\n  collect(/(\\d+)\\s*d[ií]as\\s*x\\s*([\\d.,]+)\\s*€\\s*\\/\\s*d[ií]a/gi, function (mm) {\n    var days = parseInt(mm[1], 10), price = esNum(mm[2]);\n    var line = { group: \"charges\", line_type: \"bono_social\", concept: \"Financiación bono social fijo\", detail: mm[0].trim(), quantity: days, unit: \"días\", unit_price: price, days: days, amount: round2(days * price) };\n    dayLines.push(line);\n    return line;\n  });\n  collect(/([\\d.,]+)\\s*mes(?:es)?\\s*x\\s*([\\d.,]+)\\s*€\\s*\\/\\s*mes/gi, function (mm) {\n    var qty = esNum(mm[1]), price = esNum(mm[2]);\n    return { group: \"services\", line_type: \"proteccion_hogar\", concept: \"Protección Eléctrica Hogar\", detail: mm[0].trim(), quantity: qty, unit: \"meses\", unit_price: price, amount: round2(qty * price) };\n  });\n  collect(/([\\d.,]+)\\s*%\\s*s\\s*\\/\\s*([\\d.,]+)\\s*€/gi, function (mm) {\n    var rate = esNum(mm[1]), base = esNum(mm[2]);\n    var isIva = rate != null && rate > 7;\n    return { group: \"taxes\", line_type: isIva ? \"iva\" : \"impuesto_electricidad\", concept: isIva ? \"IVA\" : \"Impuesto sobre electricidad\", detail: mm[0].trim(), unit: \"%\", unit_price: null, vat_rate: rate, tax_base: base, amount: round2((rate / 100) * base) };\n  });\n  for (var d = 0; d < dayLines.length; d++) {\n    if (d === 1) { dayLines[d].group = \"services\"; dayLines[d].line_type = \"alquiler_contador\"; dayLines[d].concept = \"Alquiler equipos medida\"; }\n  }\n  found.sort(function (a, b) { return a.index - b.index; });\n  var lines = found.map(function (f, i) { var o = f.data; o.line_no = i + 1; return o; });\n  if (t.consumption_kwh == null && energyMatches.length) {\n    var s = 0;\n    for (var e = 0; e < energyMatches.length; e++) s += (energyMatches[e].quantity || 0);\n    t.consumption_kwh = round2(s);\n  }\n  t.lines = lines;\n  return { header: t, lines: lines, consumption: consumption };\n}\n\n\nvar base = \"https://insforge.benicolo.com\"; var bucket = \"iberdrola\";\nvar out = []; var all = $input.all();\nfor (var idx = 0; idx < all.length; idx++) {\n  var item = all[idx]; var j = item.json || {};\n  var text = j.text || j.data || j.content || \"\";\n  var r = parseIberdrola(text); var h = r.header;\n  if (!h.invoice_number) continue;\n  var messageId = j.messageId || j.id || null;\n  var key = \"iberdrola/\" + (h.contract_number || \"unknown\") + \"/\" + (h.invoice_number || messageId || \"factura\") + \".pdf\";\n  var payload = {\n    p_invoice: {\n      message_id: messageId,\n      contract_number: h.contract_number || null,\n      contract_label: h.contract_label || null,\n      invoice_number: h.invoice_number || null,\n      issue_date: h.issue_date || null,\n      period_start: h.period_start || null,\n      period_end: h.period_end || null,\n      due_date: h.due_date || null,\n      tariff: h.tariff || null,\n      days_billed: (h.days_billed == null ? null : String(h.days_billed)),\n      total: h.total,\n      subtotal: h.subtotal,\n      energy_amount: h.energy_amount,\n      charges_amount: h.charges_amount,\n      services_amount: h.services_amount,\n      tax_amount: h.tax_amount,\n      consumption_kwh: h.consumption_kwh,\n      cups: h.cups || null,\n      supply_address: h.supply_address || null,\n      city: h.city || null,\n      titular: h.titular || null,\n      nif: h.nif || null,\n      contracted_power_punta: h.contracted_power_punta,\n      contracted_power_valle: h.contracted_power_valle,\n      pdf_key: key,\n      pdf_url: base + \"/api/storage/buckets/\" + bucket + \"/objects/\" + encodeURIComponent(key),\n      raw_text: h.raw_text\n    },\n    p_lines: r.lines,\n    p_consumption: r.consumption\n  };\n  out.push({ json: { message_id: messageId, key: key, invoice_number: h.invoice_number, contract_number: h.contract_number, total: h.total, lines_count: r.lines.length, payload: payload }, binary: item.binary });\n}\nreturn out;\n"
    },
    position: [940, 1100]
  },
  output: [{ message_id: '18f0000000000000', key: 'iberdrola/279914829/21240222010006319.pdf', lines_count: 9 }]
});

const ibe_dbUpsert = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'ibe – DB Upsert Invoice',
    parameters: {
      method: 'POST',
      url: ibe_INS_FORGE_BASE + '/api/database/rpc/iberdrola_upsert_invoice',
      sendHeaders: true,
      headerParameters: INS_FORGE_HEADERS,
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json.payload) }}',
      options: {}
    },
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    position: [1180, 1100]
  },
  output: [{ id: '00000000-0000-0000-0000-000000000000', invoice_number: '21240222010006319' }]
});

const ibe_reattach = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'ibe – Reattach PDF',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: "var parsed = $('ibe – Parse Iberdrola').all();\nvar byInv = {};\nfor (var i = 0; i < parsed.length; i++) { var pj = parsed[i].json || {}; if (pj.invoice_number) byInv[pj.invoice_number] = parsed[i]; }\nvar resp = $input.all(); var out = [];\nfor (var r = 0; r < resp.length; r++) {\n  var j = resp[r].json || {};\n  var src = byInv[j.invoice_number];\n  out.push({ json: { invoice_id: j.id || null, key: src ? (src.json.key || null) : null }, binary: src ? src.binary : undefined });\n}\nreturn out;"
    },
    position: [1420, 1100]
  },
  output: [{ invoice_id: '00000000-0000-0000-0000-000000000000', key: 'iberdrola/279914829/21240222010006319.pdf' }]
});

const ibe_uploadPdf = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'ibe – Upload to InsForge',
    parameters: {
      method: 'PUT',
      url: '=' + ibe_INS_FORGE_BASE + '/api/storage/buckets/' + ibe_BUCKET + '/objects/{{ encodeURIComponent($json.key) }}',
      sendHeaders: true,
      headerParameters: INS_FORGE_HEADERS,
      sendBody: true,
      contentType: 'multipart-form-data',
      bodyParameters: {
        parameters: [
          { parameterType: 'formBinaryData', name: 'file', inputDataFieldName: 'data' }
        ]
      },
      options: {}
    },
    retryOnFail: true,
    maxTries: 4,
    waitBetweenTries: 3000,
    onError: 'continueRegularOutput',
    position: [1660, 1100]
  },
  output: [{ key: 'iberdrola/279914829/21240222010006319.pdf' }]
});

const way_INS_FORGE_BASE = 'https://insforge.benicolo.com';
const way_BUCKET = 'waylet';

const way_gmailTrigger = trigger({
  type: 'n8n-nodes-base.way_gmailTrigger',
  version: 1.3,
  config: {
    name: 'way – New Waylet Ticket',
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
    position: [220, 1900]
  },
  output: [{ id: '18f0000000000000', subject: 'Waylet - ES GLEM S.L COCENTAINA', text: '...' }]
});

const way_extractLink = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'way – Extract link',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "var out = [];\nvar items = $input.all();\nfor (var i = 0; i < items.length; i++) {\n  var j = items[i].json || {};\n  var body = String(j.html || j.text || j.body || \"\");\n  var m = body.match(/https:\\/\\/waylet\\.repsol\\.everiscloudpayments\\.com\\/waylet\\/api\\/public\\/klikin\\/ticket-services\\/v1\\/ticket\\/[A-Za-z0-9]+/);\n  if (!m) continue;\n  var subject = j.subject || (j.headers && j.headers.subject) || \"\";\n  var lm = String(subject).match(/Waylet\\s*-\\s*ES GLEM S\\.?L\\.?\\s+(.+)$/i);\n  out.push({ json: { messageId: j.id || null, subject: subject, locality: lm ? lm[1].trim() : null, url: m[0] } });\n}\nreturn out;" },
    position: [460, 1900]
  },
  output: [{ messageId: '18f0000000000000', locality: 'COCENTAINA', url: 'https://waylet.repsol.everiscloudpayments.com/...' }]
});

const way_downloadPdf = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'way – Download PDF',
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
    position: [700, 1900]
  },
  output: [{ data: {} }]
});

const way_extractPdf = node({
  type: 'n8n-nodes-base.extractFromFile',
  version: 1.1,
  config: {
    name: 'way – Extract PDF Text',
    parameters: { operation: 'pdf', binaryPropertyName: 'data', options: { keepSource: 'both' } },
    onError: 'continueRegularOutput',
    position: [940, 1900]
  },
  output: [{ text: 'ES GLEM SL ...' }]
});

const way_parseWaylet = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'way – Parse Waylet',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "function norm(s) {\n  return String(s == null ? \"\" : s).replace(/\\uFB01/g, \"fi\").replace(/\\uFB02/g, \"fl\");\n}\nfunction esNum(s) {\n  if (s == null) return null;\n  var v = String(s).trim().replace(/\\s/g, \"\").replace(/€/g, \"\");\n  if (!v) return null;\n  if (v.indexOf(\",\") >= 0) v = v.replace(/\\./g, \"\").replace(\",\", \".\");\n  var n = parseFloat(v);\n  return isNaN(n) ? null : n;\n}\n\nfunction way_parseWaylet(rawText) {\n  var text = norm(rawText);\n  var t = { raw_text: text };\n  var m;\n  var discountLabel = null;\n\n  // Station + address + postal code / locality\n  m = text.match(/(ES\\s+GLEM\\s+S\\.?L\\.?)/i);\n  if (m) t.station_name = m[1].replace(/\\s+/g, \" \").trim();\n  else {\n    m = text.match(/(GLEM\\s+S\\.?L\\.?)/i);\n    if (m) t.station_name = m[1].trim();\n  }\n  m = text.match(/(C\\/|CL)\\s+[^\\n]+/);\n  if (m) t.address = m[0].trim();\n  m = text.match(/(\\d{5})\\s*-\\s*([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑ ]+)/);\n  if (m) {\n    t.postal_code = m[1];\n    t.locality = m[2].trim();\n  }\n\n  // Date + time\n  m = text.match(/Fecha:\\s*(\\d{2})-(\\d{2})-(\\d{4})/);\n  var fecha = m ? m[3] + \"-\" + m[2] + \"-\" + m[1] : null;\n  m = text.match(/Hora:\\s*(\\d{2}:\\d{2}(?::\\d{2})?)/);\n  var hora = m ? m[1] : null;\n  t.purchased_at = fecha ? fecha + \"T\" + (hora ? (hora.length === 5 ? hora + \":00\" : hora) : \"00:00:00\") : null;\n\n  // Product table.\n  // Layout A (n8n Extract): columns preserved on one header line\n  //   PRODUCTO €/L LITROS IMPORTE\n  //   Diesel e+ 1,939 25,78 49,99\n  m = text.match(/PRODUCTO\\s+€\\/L\\s+LITROS\\s+IMPORTE\\s*\\n\\s*([^\\n]+?)\\s+(-?[\\d.,]+)\\s+(-?[\\d.,]+)\\s+(-?[\\d.,]+)/i);\n  if (m) {\n    t.fuel_type = m[1].trim();\n    t.unit_price = esNum(m[2]);\n    t.liters = esNum(m[3]);\n    t.gross_amount = esNum(m[4]);\n    var rest = text.slice(m.index + m[0].length);\n    var dm = rest.match(/\\n\\s*([^\\n]+?)\\s+(-[\\d.,]+)\\s*\\n/);\n    if (dm && !/Total/i.test(dm[1])) discountLabel = dm[1].trim();\n    if (dm && !/Total/i.test(dm[1])) t.discount_amount = Math.abs(esNum(dm[2]));\n  } else {\n    // Layout B (pdftotext): columns stacked\n    m = text.match(/PRODUCTO\\s*€\\/L\\s*([^\\n]+)\\s+([\\d.,]+)/i);\n    if (m) {\n      t.fuel_type = m[1].trim();\n      t.unit_price = esNum(m[2]);\n    }\n    m = text.match(/LITROS\\s*([\\d.,]+)/i);\n    if (m) t.liters = esNum(m[1]);\n    m = text.match(/([^\\n]+)\\n\\s*LITROS/i);\n    if (m && m[1] && !/^[\\d.,\\s]+$/.test(m[1])) discountLabel = m[1].trim();\n    m = text.match(/IMPORTE\\s+(-?[\\d.,]+)\\s+(-?[\\d.,]+)/i);\n    if (m) {\n      t.gross_amount = esNum(m[1]);\n      t.discount_amount = Math.abs(esNum(m[2]));\n    }\n  }\n\n  // Totals\n  m = text.match(/Total descuento:\\s*([\\d.,]+)\\s*€/i);\n  if (m && (t.discount_amount == null || t.discount_amount === 0)) t.discount_amount = Math.abs(esNum(m[1]));\n  m = text.match(/Total Venta:\\s*([\\d.,]+)\\s*€/i);\n  if (m) t.total = esNum(m[1]);\n  if (t.total == null) {\n    m = text.match(/Total tarjeta:\\s*([\\d.,]+)\\s*€/i);\n    if (m) t.total = esNum(m[1]);\n  }\n\n  // Payment\n  m = text.match(/Pago Waylet\\s+(.+?)\\s*\\*+(\\d{4})/i);\n  if (m) {\n    t.payment_method = m[1].replace(/\\s+/g, \" \").trim();\n    t.card_last4 = m[2];\n  }\n\n  // Ticket number + waylet id\n  m = text.match(/N\\.?\\s*de ticket\\s*(\\d+)/i);\n  if (m) t.ticket_number = m[1];\n  m = text.match(/Id:\\s*([0-9a-fA-F-]{36})/);\n  if (m) t.waylet_id = m[1];\n\n  // Lines (primary fuel + discount / other products)\n  var lines = [];\n  if (t.fuel_type || t.gross_amount != null) {\n    lines.push({ product_name: t.fuel_type || \"Combustible\", unit_price: t.unit_price, amount: t.gross_amount });\n  }\n  if (t.discount_amount != null && t.discount_amount > 0) {\n    lines.push({ product_name: discountLabel || \"Descuento\", unit_price: null, amount: -t.discount_amount });\n  }\n\n  return { header: t, lines: lines };\n}\n\n\nvar base = \"https://insforge.benicolo.com\"; var bucket = \"waylet\";\nvar meta = $('way – Extract link').all();\nvar items = $input.all(); var out = [];\nfor (var i = 0; i < items.length; i++) {\n  var item = items[i]; var j = item.json || {};\n  var text = j.text || j.data || \"\";\n  var r = way_parseWaylet(text); var h = r.header;\n  if (!h.ticket_number) continue;\n  var mi = meta[i] ? (meta[i].json || {}) : {};\n  var messageId = mi.messageId || j.id || null;\n  var locality = h.locality || mi.locality || null;\n  var key = \"waylet/\" + (h.ticket_number || messageId || \"ticket\") + \".pdf\";\n  var payload = {\n    p_ticket: {\n      message_id: messageId,\n      waylet_id: h.waylet_id || null,\n      ticket_number: h.ticket_number,\n      purchased_at: h.purchased_at || null,\n      station_name: h.station_name || null,\n      address: h.address || null,\n      postal_code: h.postal_code || null,\n      locality: locality,\n      fuel_type: h.fuel_type || null,\n      liters: h.liters,\n      unit_price: h.unit_price,\n      gross_amount: h.gross_amount,\n      discount_amount: h.discount_amount,\n      total: h.total,\n      payment_method: h.payment_method || null,\n      card_last4: h.card_last4 || null,\n      vehicle_plate: h.vehicle_plate || null,\n      points: h.points,\n      pdf_key: key,\n      pdf_url: base + \"/api/storage/buckets/\" + bucket + \"/objects/\" + encodeURIComponent(key),\n      raw_text: h.raw_text\n    },\n    p_lines: r.lines\n  };\n  out.push({ json: { message_id: messageId, key: key, ticket_number: h.ticket_number, locality: locality, payload: payload }, binary: item.binary });\n}\nreturn out;\n" },
    position: [1180, 1900]
  },
  output: [{ ticket_number: '262400250757', key: 'waylet/262400250757.pdf' }]
});

const way_dbUpsert = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'way – DB Upsert Ticket',
    parameters: {
      method: 'POST',
      url: way_INS_FORGE_BASE + '/api/database/rpc/waylet_upsert_ticket',
      sendHeaders: true,
      headerParameters: INS_FORGE_HEADERS,
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json.payload) }}',
      options: {}
    },
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    position: [1420, 1900]
  },
  output: [{ id: '00000000-0000-0000-0000-000000000000', ticket_number: '262400250757' }]
});

const way_reattach = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'way – Reattach PDF',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "var parsed = $('way – Parse Waylet').all();\nvar byTicket = {};\nfor (var i = 0; i < parsed.length; i++) { var pj = parsed[i].json || {}; if (pj.ticket_number) byTicket[pj.ticket_number] = parsed[i]; }\nvar resp = $input.all(); var out = [];\nfor (var r = 0; r < resp.length; r++) {\n  var j = resp[r].json || {};\n  var src = byTicket[j.ticket_number];\n  out.push({ json: { ticket_id: j.id || null, key: src ? (src.json.key || null) : null }, binary: src ? src.binary : undefined });\n}\nreturn out;" },
    position: [1660, 1900]
  },
  output: [{ ticket_id: '00000000-0000-0000-0000-000000000000', key: 'waylet/262400250757.pdf' }]
});

const way_uploadPdf = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'way – Upload to InsForge',
    parameters: {
      method: 'PUT',
      url: '=' + way_INS_FORGE_BASE + '/api/storage/buckets/' + way_BUCKET + '/objects/{{ encodeURIComponent($json.key) }}',
      sendHeaders: true,
      headerParameters: INS_FORGE_HEADERS,
      sendBody: true,
      contentType: 'multipart-form-data',
      bodyParameters: { parameters: [{ parameterType: 'formBinaryData', name: 'file', inputDataFieldName: 'data' }] },
      options: {}
    },
    retryOnFail: true,
    maxTries: 4,
    waitBetweenTries: 3000,
    onError: 'continueRegularOutput',
    position: [1900, 1900]
  },
  output: [{ key: 'waylet/262400250757.pdf' }]
});

const sup_INS_FORGE_BASE = 'https://insforge.benicolo.com';
const sup_BUCKET = 'suppliers';

const sup_parseCode = `function norm(s) {
  return String(s == null ? "" : s).replace(/\\uFB01/g, "fi").replace(/\\uFB02/g, "fl").replace(/\\u00a0/g, " ");
}
function esNum(s) {
  if (s == null) return null;
  var v = String(s).trim().replace(/\\s/g, "").replace(/€/g, "");
  if (!v) return null;
  if (v.indexOf(",") >= 0) v = v.replace(/\\./g, "").replace(",", ".");
  var n = parseFloat(v);
  return isNaN(n) ? null : n;
}
function isoDate(dmy) {
  var m = String(dmy || "").match(/(\\d{2})-(\\d{2})-(\\d{4})/);
  return m ? m[3] + "-" + m[2] + "-" + m[1] : null;
}
function parseAlbero(rawText) {
  var text = norm(rawText);
  var t = { raw_text: text };
  var m;
  t.supplier_name = "TRANSPORTES ALBERO S.L.";
  if (/B0?3075116/.test(text)) t.supplier_tax_id = "B03075116";
  m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/i);
  if (m) t.supplier_email = m[0];
  m = text.match(/\\b(9\\d{8})\\b/);
  if (m) t.supplier_phone = m[1];
  m = text.match(/CAE\\s+exp\\S*[\\s\\S]{0,60}?([A-Z]{2}\\d{3,}[A-Z0-9]+)/i);
  if (m) t.cae = m[1];
  m = text.match(/C\\.?\\s*R\\.?\\s*E\\.?\\s*([A-Z0-9]{6,})/i);
  if (m) t.cre = m[1];
  m = text.match(/Ref\\.?\\s*Local\\s*([A-Z0-9]+)/i);
  if (m) t.ref_local = m[1];
  m = text.match(/Factura:\\s*(\\d+)\\s*de\\s*(\\d{2}-\\d{2}-\\d{4})/i);
  if (m) { t.invoice_number = m[1]; t.issue_date = isoDate(m[2]); }
  if (!t.invoice_number) { m = text.match(/Factura[^\\d]{0,20}(\\d{3,})/i); if (m) t.invoice_number = m[1]; }
  m = text.match(/albar\\S{0,3}n:?\\s*(\\d{3,})/i);
  if (m) t.albaran = m[1];
  m = text.match(/pedido:\\s*([^\\n]*?)(?=\\s{2,}|Alb\\.|circu|\\n|$)/i);
  if (m) t.pedido = m[1].trim().replace(/\\s+/g, " ");
  m = text.match(/circu\\.?:?\\s*([A-Z0-9]+)/i);
  if (m) t.alb_circu = m[1];
  m = text.match(/Fecha de entrega\\s*(\\d{2}-\\d{2}-\\d{4})/i);
  if (m) t.delivery_date = isoDate(m[1]);
  m = text.match(/Nombre del producto\\s+([A-Z][A-Z0-9\\s.\\/-]{2,40})/i);
  if (!m) m = text.match(/Nombre del producto[^\\n]*\\n\\s*([A-Z][A-Z0-9\\s.\\/-]{2,40})/i);
  if (!m) m = text.match(/Producto\\s+([A-Z][A-Z0-9\\s.\\/-]{2,40})/);
  if (m) t.product = m[1].trim().replace(/\\s+/g, " ");
  m = text.match(/\\b(LTR|LT|KG|UD)\\b/);
  if (m) t.unit = m[1].toUpperCase();
  m = text.match(/LTR\\s+(\\d{1,7})/i) || text.match(/Cantidad\\s+(\\d{1,7})/i);
  if (m) t.quantity = esNum(m[1]);
  m = text.match(/(\\d{1,4},\\d{6})/);
  if (m) t.unit_price = esNum(m[1]);
  m = text.match(/IMPONIBLE:?\\s*([\\d.,]+)/i);
  if (m) t.base = esNum(m[1]);
  m = text.match(/%\\s*IVA\\s*([\\d.,]+)/i);
  if (m) t.vat_rate = esNum(m[1]);
  m = text.match(/TOTAL\\s*IVA:?\\s*([\\d.,]+)/i);
  if (m) t.vat_amount = esNum(m[1]);
  m = text.match(/(?:^|\\n)[^\\n]*TOTAL:?\\s*([\\d.,]+)/i);
  if (m) t.total = esNum(m[1]);
  if (t.total == null && t.base != null && t.vat_amount != null) t.total = Math.round((t.base + t.vat_amount) * 100) / 100;
  t.amount = t.total;
  m = text.match(/FORMA DE PAGO:?\\s*([^\\n]+)/i);
  if (m) t.payment_method = m[1].replace(/\\s+/g, " ").trim();
  m = text.match(/Matr\\S*?cula\\s*([A-Z0-9]{4,8})/i);
  if (m) t.plate = m[1];
  m = text.match(/Conductor\\s+(?!Densidad)([A-Z][A-Z .]{3,40})/i);
  if (m) t.driver = m[1].trim().replace(/\\s+/g, " ");
  m = text.match(/Densidad\\s*15\\S?\\s*C:?\\s*([\\d.,]+)/i);
  if (m) t.density = esNum(m[1]);
  m = text.match(/([A-Z][A-Z ]{5,40})\\s*\\n\\s*Titular/);
  if (m) t.customer_name = m[1].trim().replace(/\\s+/g, " ");
  m = text.match(/(\\d{8}[A-Z])\\b/);
  if (m) t.customer_tax_id = m[1];
  var lines = [];
  if (t.product || t.total != null) {
    lines.push({ line_no: 1, product_name: t.product || "GASOLEO C", quantity: t.quantity, unit: t.unit, unit_price: t.unit_price, amount: t.amount });
  }
  return { header: t, lines: lines };
}
var base = "https://insforge.benicolo.com";
var bucket = "suppliers";
var all = $input.all();
var groups = {};
for (var idx = 0; idx < all.length; idx++) {
  var item = all[idx];
  var j = item.json || {};
  var text = j.text || j.data || j.content || "";
  if (!text) continue;
  var r = parseAlbero(text);
  var id = j.messageId || j.id || null;
  if (!groups[id]) groups[id] = { invoices: [], others: [] };
  if (r.header.invoice_number) groups[id].invoices.push({ it: item, r: r });
  else groups[id].others.push({ it: item, r: r });
}
var out = [];
for (var gid in groups) {
  var g = groups[gid];
  if (!g.invoices.length) continue;
  var iv = g.invoices[0];
  var h = iv.r.header;
  delete h.raw_text;
  h.message_id = gid;
  h.document_type = h.document_type || "nota_entrega_factura";
  h.pdf_key = iv.it.json.key || null;
  h.pdf_url = h.pdf_key ? (base + "/api/storage/buckets/" + bucket + "/objects/" + encodeURIComponent(h.pdf_key)) : null;
  var resp = g.others[0] || null;
  if (resp) {
    h.responsibility_pdf_key = resp.it.json.key || null;
    h.responsibility_pdf_url = h.responsibility_pdf_key ? (base + "/api/storage/buckets/" + bucket + "/objects/" + encodeURIComponent(h.responsibility_pdf_key)) : null;
    h.responsibility_filename = resp.it.json.filename || null;
  }
  var binary = { data: iv.it.binary ? iv.it.binary.data : undefined };
  if (resp && resp.it.binary && resp.it.binary.data) binary.responsibility = resp.it.binary.data;
  out.push({ json: { message_id: gid, invoice_number: h.invoice_number, key: h.pdf_key, responsibility_key: h.responsibility_pdf_key || null, payload: { p_invoice: h, p_lines: iv.r.lines } }, binary: binary });
}
return out;`;

const sup_gmailTrigger = trigger({
  type: 'n8n-nodes-base.sup_gmailTrigger',
  version: 1.3,
  config: {
    name: 'sup – New Supplier Invoice (Albero)',
    parameters: {
      pollTimes: { item: [{ mode: 'everyMinute' }] },
      event: 'messageReceived',
      simple: false,
      filters: {
        q: 'from:maque@alberosl.com has:attachment filename:pdf',
        readStatus: 'both'
      },
      options: {
        downloadAttachments: true,
        dataPropertyAttachmentsPrefixName: 'attachment_'
      }
    },
    credentials: { gmailOAuth2: newCredential('Gmail account') },
    position: [220, 2700]
  },
  output: [{ id: '18f0000000000000', subject: 'Factura Transportes Albero' }]
});

const sup_expandPdfs = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'sup – Expand PDFs',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const out = [];
for (const item of $input.all()) {
  const bin = item.binary || {};
  const id = (item.json && item.json.id) ? item.json.id : "unknown";
  for (const prop of Object.keys(bin)) {
    const meta = bin[prop];
    if (prop.indexOf("attachment_") === 0 && meta && meta.mimeType === "application/pdf") {
      const name = meta.fileName ? meta.fileName : (prop + ".pdf");
      const safeName = String(name).replace(/[^A-Za-z0-9._-]+/g, "_");
      out.push({
        json: { messageId: id, key: "suppliers/" + id + "/" + safeName, filename: name, mimeType: meta.mimeType, size: meta.fileSize || 0 },
        binary: { data: bin[prop] }
      });
    }
  }
}
return out;`
    },
    position: [460, 2700]
  },
  output: [{ key: 'suppliers/18f0000000000000/factura.pdf', messageId: '18f0000000000000' }]
});

const sup_extractPdf = node({
  type: 'n8n-nodes-base.extractFromFile',
  version: 1.1,
  config: {
    name: 'sup – Extract PDF Text',
    parameters: { operation: 'pdf', binaryPropertyName: 'data', options: { keepSource: 'both' } },
    onError: 'continueRegularOutput',
    position: [700, 2700]
  },
  output: [{ text: 'TRANSPORTES ALBERO S.L. ...' }]
});

const sup_parseInvoice = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'sup – Parse Albero',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: sup_parseCode },
    position: [940, 2700]
  },
  output: [{ invoice_number: '25760098', key: 'suppliers/18f0000000000000/factura.pdf' }]
});

const sup_dbUpsert = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'sup – DB Upsert Invoice',
    parameters: {
      method: 'POST',
      url: sup_INS_FORGE_BASE + '/api/database/rpc/supplier_invoice_upsert',
      sendHeaders: true,
      headerParameters: INS_FORGE_HEADERS,
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json.payload) }}',
      options: {}
    },
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    onError: 'continueRegularOutput',
    position: [1180, 2700]
  },
  output: [{ id: '00000000-0000-0000-0000-000000000000', invoice_number: '25760098' }]
});

const sup_splitFiles = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'sup – Split Files',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `var src = $('sup – Parse Albero').all();
var byNum = {};
for (var i = 0; i < src.length; i++) { var s = src[i].json || {}; if (s.invoice_number) byNum[s.invoice_number] = src[i]; }
var resp = $input.all();
var out = [];
for (var r = 0; r < resp.length; r++) {
  var j = resp[r].json || {};
  var s = byNum[j.invoice_number];
  if (!s) continue;
  var sb = s.binary || {};
  out.push({ json: { invoice_number: j.invoice_number, invoice_id: j.id || null, key: s.json.key || null, role: 'invoice' }, binary: { data: sb.data } });
  if (s.json.responsibility_key && sb.responsibility) {
    out.push({ json: { invoice_number: j.invoice_number, invoice_id: j.id || null, key: s.json.responsibility_key, role: 'responsibility' }, binary: { data: sb.responsibility } });
  }
}
return out;`
    },
    position: [1420, 2700]
  },
  output: [{ invoice_number: '25760098', key: 'suppliers/18f0000000000000/factura.pdf', role: 'invoice' }]
});

const sup_uploadPdf = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'sup – Upload to InsForge',
    parameters: {
      method: 'PUT',
      url: '=' + sup_INS_FORGE_BASE + '/api/storage/buckets/' + sup_BUCKET + '/objects/{{ encodeURIComponent($json.key) }}',
      sendHeaders: true,
      headerParameters: INS_FORGE_HEADERS,
      sendBody: true,
      contentType: 'multipart-form-data',
      bodyParameters: { parameters: [{ parameterType: 'formBinaryData', name: 'file', inputDataFieldName: 'data' }] },
      options: {}
    },
    retryOnFail: true,
    maxTries: 4,
    waitBetweenTries: 3000,
    onError: 'continueRegularOutput',
    position: [1660, 2700]
  },
  output: [{ key: 'suppliers/18f0000000000000/factura.pdf' }]
});

const bank_INS_FORGE_BASE = 'https://insforge.benicolo.com';
const bank_BUCKET = 'bank-statements';
const bank_WEBHOOK_PATH = 'bank-statements';
const bank_WEBHOOK_TOKEN = 'bk_edcd4520c3d4aa55f4c49cce38ad574b1315dc1b2e1b7ecc';

const bank_webhookTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'bank – Bank TXT Webhook',
    parameters: {
      httpMethod: 'POST',
      path: bank_WEBHOOK_PATH,
      responseMode: 'responseNode',
      options: {
        binaryData: true,
        binaryPropertyName: 'data'
      }
    },
    position: [200, 3500]
  },
  output: [{ headers: { 'x-webhook-token': bank_WEBHOOK_TOKEN }, body: {} }]
});

const bank_checkToken = ifElse({
  version: 2.3,
  config: {
    name: 'bank – Check Token',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        combinator: 'and',
        conditions: [
          {
            leftValue: "={{ $json.headers['x-webhook-token'] || $json.headers['X-Webhook-Token'] }}",
            rightValue: bank_WEBHOOK_TOKEN,
            operator: { type: 'string', operation: 'equals' }
          }
        ]
      }
    },
    position: [440, 3500]
  }
});

// Reads the uploaded file with this.helpers.getBinaryDataBuffer so it also works
// when the workflow runs in "separate" binary mode, then decodes it as Latin-1.
const bank_parseTxt = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'bank – Parse TXT',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `function toNum(s) {
  if (s === null || s === undefined) return null;
  var v = String(s).trim().replace(/\\s/g, "");
  if (!v) return null;
  if (v.indexOf(",") >= 0) v = v.replace(/\\./g, "").replace(",", ".");
  var n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function toDate(s) {
  if (!s) return null;
  var m = String(s).trim().match(/^(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})$/);
  if (!m) return null;
  var d = m[1].padStart(2, "0");
  var mo = m[2].padStart(2, "0");
  return m[3] + "-" + mo + "-" + d;
}

var items = $input.all();
var out = [];
for (var a = 0; a < items.length; a++) {
  var item = items[a];
  var bin = item.binary || {};
  var key = Object.keys(bin)[0];
  if (!key) continue;

  var buf = null;
  try {
    if (this && this.helpers && typeof this.helpers.getBinaryDataBuffer === "function") {
      buf = await this.helpers.getBinaryDataBuffer(a, key);
    }
  } catch (e) {
    buf = null;
  }
  if (!buf) {
    var b64 = bin[key] && bin[key].data ? bin[key].data : "";
    if (b64) buf = Buffer.from(b64, "base64");
  }
  if (!buf) continue;

  var text = Buffer.isBuffer(buf) ? buf.toString("latin1") : String(buf);
  var fileName = (bin[key] && bin[key].fileName) || (item.json && item.json.fileName) || "movimientos.txt";

  var lines = text.replace(/\\r/g, "").split("\\n");
  var rows = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    var f = line.split("|");
    if (f.length < 7) continue;
    var opDate = toDate(f[0]);
    var amount = toNum(f[3]);
    if (opDate === null || amount === null) continue;
    rows.push({
      operation_date: opDate,
      description: f[1] || null,
      value_date: toDate(f[2]),
      amount: amount,
      balance: toNum(f[4]),
      counterparty_tax_id: (f[5] || "").trim() || null,
      reference: (f[6] || "").trim() || null,
      raw_line: line
    });
  }

  var safeName = String(fileName).replace(/[^A-Za-z0-9._-]+/g, "_");
  var stamp = new Date().toISOString().replace(/[:.]/g, "-");
  var rawKey = "statements/" + stamp + "-" + safeName;

  out.push({
    json: { rows: rows, count: rows.length, text_len: text.length, source_file: fileName, raw_key: rawKey },
    binary: { file: bin[key] }
  });
}
if (out.length === 0) {
  throw new Error("No se pudo leer el fichero: envio vacio o sin datos binarios.");
}
return out;`
    },
    position: [680, 3500]
  },
  output: [{ rows: [], count: 0, text_len: 0, source_file: 'movimientos.txt', raw_key: 'statements/x-movimientos.txt' }]
});

const bank_uploadTxt = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'bank – Upload TXT',
    parameters: {
      method: 'PUT',
      url: '=' + bank_INS_FORGE_BASE + '/api/storage/buckets/' + bank_BUCKET + '/objects/{{ encodeURIComponent($json.raw_key) }}',
      sendHeaders: true,
      headerParameters: INS_FORGE_HEADERS,
      sendBody: true,
      contentType: 'multipart-form-data',
      bodyParameters: {
        parameters: [
          { parameterType: 'formBinaryData', name: 'file', inputDataFieldName: 'file' }
        ]
      },
      options: {}
    },
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    onError: 'continueRegularOutput',
    position: [920, 3500]
  },
  output: [{ key: 'statements/x-movimientos.txt' }]
});

const bank_dbUpsert = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'bank – DB Upsert',
    parameters: {
      method: 'POST',
      url: bank_INS_FORGE_BASE + '/api/database/rpc/bank_upsert_transactions',
      sendHeaders: true,
      headerParameters: INS_FORGE_HEADERS,
      sendBody: true,
      specifyBody: 'json',
      jsonBody: "={{ JSON.stringify({ p_rows: $('bank – Parse TXT').first().json.rows, p_source_file: $('bank – Parse TXT').first().json.source_file, p_raw_key: $('bank – Parse TXT').first().json.raw_key }) }}",
      options: {}
    },
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    position: [1160, 3500]
  },
  output: [{ inserted: 0, skipped: 0, total: 0 }]
});

const bank_respondOk = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'bank – Respond OK',
    parameters: {
      respondWith: 'json',
      responseBody: "={{ { ok: true, inserted: $json.inserted, skipped: $json.skipped, total: $json.total, parsed: $('bank – Parse TXT').first().json.count, text_len: $('bank – Parse TXT').first().json.text_len, source_file: $('bank – Parse TXT').first().json.source_file, raw_key: $('bank – Parse TXT').first().json.raw_key } }}"
    },
    position: [1400, 3460]
  },
  output: [{ ok: true, inserted: 0, skipped: 0, total: 0 }]
});

const bank_respondUnauthorized = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'bank – Respond Unauthorized',
    parameters: {
      respondWith: 'json',
      responseBody: "={{ { ok: false, error: 'unauthorized' } }}",
      options: { responseCode: 401 }
    },
    position: [680, 3720]
  },
  output: [{ ok: false, error: 'unauthorized' }]
});

const photo_INS_FORGE_BASE = 'https://insforge.benicolo.com';
const photo_BUCKET = 'receipts';
const photo_WEBHOOK_PATH = 'ticket-photo';
const photo_WEBHOOK_TOKEN = 'ph_ti_e64322429728a0379074277ea28e552376f41554f1b64726';
const photo_INS_FORGE_API_KEY = 'ik_06af335eeadbdfe2f6c12fa82c1d152c512a516af32ba808a37bfbfdb6ee0900';
const photo_INS_FORGE_HEADERS = { parameters: [{ name: 'Authorization', value: 'Bearer ' + photo_INS_FORGE_API_KEY }] };

const photo_OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const photo_OPENROUTER_MODEL = 'deepseek/deepseek-v4.1-flash';
// Se inyecta en el build desde n8n/.env.local (scripts/n8n-build.js). Nunca se versiona la key real.
const photo_OPENROUTER_API_KEY = '__OPENROUTER_API_KEY__';
const photo_OPENROUTER_HEADERS = { parameters: [{ name: 'Authorization', value: 'Bearer ' + photo_OPENROUTER_API_KEY }] };

const photo_webhookTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'photo – Ticket Photo Webhook',
    parameters: {
      httpMethod: 'POST',
      path: photo_WEBHOOK_PATH,
      responseMode: 'responseNode',
      options: {
        binaryData: true,
        binaryPropertyName: 'data'
      }
    },
    position: [200, 4300]
  },
  output: [{ headers: { 'x-webhook-token': photo_WEBHOOK_TOKEN }, body: { raw_text: 'TOTAL 12,50', captured_at: '2026-10-08T10:00:00Z' } }]
});

const photo_checkToken = ifElse({
  version: 2.3,
  config: {
    name: 'photo – Check Token',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        combinator: 'and',
        conditions: [
          {
            leftValue: "={{ $json.headers['x-webhook-token'] || $json.headers['X-Webhook-Token'] }}",
            rightValue: photo_WEBHOOK_TOKEN,
            operator: { type: 'string', operation: 'equals' }
          }
        ]
      }
    },
    position: [440, 4300]
  }
});

const photo_buildEncode = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'photo – Build & Encode',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const item = $input.first();
const bin = item.binary || {};
const bk = Object.keys(bin)[0];
const b = bk ? bin[bk] : {};
const body = (item.json && item.json.body) || {};
const raw = body.raw_text || '';
const mime = b.mimeType || 'image/jpeg';
const ext = b.fileExtension || 'jpg';
const key = 'receipts/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;
const buf = await this.helpers.getBinaryDataBuffer(0, bk);
const b64 = buf.toString('base64');
const imageDataUrl = 'data:' + mime + ';base64,' + b64;
const NL = String.fromCharCode(10);
const systemPrompt = [
  'Eres un extractor de datos de tickets de compra.',
  'Analiza la IMAGEN del ticket y responde EXCLUSIVAMENTE con un objeto JSON valido, sin texto adicional ni bloques de codigo.',
  'Esquema:',
  '{',
  '  "store_name": string|null,',
  '  "ticket_number": string|null,',
  '  "purchased_at": string|null,',
  '  "subtotal": number|null,',
  '  "total": number|null,',
  '  "raw_text": string,',
  '  "lines": [{ "product_name": string, "quantity": number|null, "unit": string|null, "unit_price": number|null, "amount": number|null }]',
  '}',
  'Reglas:',
  '- Numeros en decimal con punto (ej. 12.50), sin simbolo de moneda ni separador de miles.',
  '- purchased_at en formato YYYY-MM-DD.',
  '- Si un dato no aparece, usa null.',
  '- "total" es el importe final pagado; NO lo confundas con "subtotal", "base imponible" ni "IVA".',
  '- En cada linea, "amount" es el importe total de la linea y "unit_price" el precio unitario.',
  '- "raw_text" es la transcripcion completa del texto visible del ticket.',
  '- No inventes datos.'
].join(NL);
const hint = raw ? (NL + 'Texto OCR de apoyo (puede contener errores; prevalece la imagen): ' + String(raw).slice(0, 1500)) : '';
const userText = 'Extrae los datos de este ticket siguiendo el esquema indicado.' + hint;
const aiBody = JSON.stringify({
  model: '${photo_OPENROUTER_MODEL}',
  temperature: 0,
  max_tokens: 4000,
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: [
      { type: 'text', text: userText },
      { type: 'image_url', image_url: { url: imageDataUrl } }
    ] }
  ]
});
return [{ json: { key: key, captured_at: body.captured_at || null, raw_text: raw, mimeType: mime, filename: b.fileName || null, aiBody: aiBody }, binary: { data: b } }];`
    },
    position: [680, 4300]
  },
  output: [{ key: 'receipts/1700000000000_abc.jpg', captured_at: '2026-10-08T10:00:00Z', aiBody: '{"model":"deepseek/deepseek-v4.1-flash"}' }]
});

const photo_upload = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'photo – Upload Image',
    parameters: {
      method: 'PUT',
      url: '=' + photo_INS_FORGE_BASE + '/api/storage/buckets/' + photo_BUCKET + '/objects/{{ encodeURIComponent($json.key) }}',
      sendHeaders: true,
      headerParameters: photo_INS_FORGE_HEADERS,
      sendBody: true,
      contentType: 'multipart-form-data',
      bodyParameters: {
        parameters: [{ parameterType: 'formBinaryData', name: 'file', inputDataFieldName: 'data' }]
      },
      options: {}
    },
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    onError: 'continueRegularOutput',
    position: [920, 4300]
  },
  output: [{ key: 'receipts/1700000000000_abc123.jpg', url: 'https://insforge.benicolo.com/api/storage/buckets/receipts/objects/receipts%2F...jpg' }]
});

const photo_aiExtract = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'photo – AI Extract',
    parameters: {
      method: 'POST',
      url: photo_OPENROUTER_URL,
      sendHeaders: true,
      headerParameters: {
        parameters: [
          ...photo_OPENROUTER_HEADERS.parameters,
          { name: 'HTTP-Referer', value: photo_INS_FORGE_BASE },
          { name: 'X-Title', value: 'Mis Gastos - Ticket Photo' }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: "={{ $('photo – Build & Encode').first().json.aiBody }}",
      options: { timeout: 60000 }
    },
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 3000,
    position: [1160, 4300]
  },
  output: [{ choices: [{ message: { content: '{"store_name":"MERCADONA","total":12.5,"lines":[]}' } }] }]
});

const photo_parseAi = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'photo – Parse AI',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const item = $input.first();
const resp = item.json || {};
let content = '';
if (resp.choices && resp.choices[0] && resp.choices[0].message) content = resp.choices[0].message.content || '';
content = String(content).trim();
if (content.indexOf('\`\`\`') === 0) {
  content = content.replace(/^\`\`\`(json)?/i, '').replace(/\`\`\`$/, '').trim();
}
let d = {};
try {
  d = JSON.parse(content);
} catch (e) {
  const s = content.indexOf('{');
  const en = content.lastIndexOf('}');
  if (s >= 0 && en > s) { try { d = JSON.parse(content.slice(s, en + 1)); } catch (e2) { d = {}; } }
}
function num(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let t = String(v).replace(/[^0-9.,-]/g, '');
  if (!t) return null;
  if (t.indexOf(',') >= 0) t = t.split('.').join('').split(',').join('.');
  const n = parseFloat(t);
  return isNaN(n) ? null : n;
}
function str(v) {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t ? t : null;
}
function date(v) {
  if (!v) return null;
  const t = String(v).trim();
  let m = t.match(/^(\\d{4})-(\\d{2})-(\\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  const p = t.split(/[\\/\\-.]/);
  if (p.length === 3) {
    const a = p[0], b = p[1], c = p[2];
    if (a.length === 4) return a + '-' + ('0' + b).slice(-2) + '-' + ('0' + c).slice(-2);
    return c + '-' + ('0' + b).slice(-2) + '-' + ('0' + a).slice(-2);
  }
  return null;
}
const build = $('photo – Build & Encode').first().json;
const up = $('photo – Upload Image').first().json || {};
const linesIn = Array.isArray(d.lines) ? d.lines : [];
const lines = linesIn.filter(function (l) { return l && (l.product_name || l.amount !== null && l.amount !== undefined); }).map(function (l, i) {
  return {
    line_no: i + 1,
    product_name: str(l.product_name),
    quantity: num(l.quantity),
    unit: str(l.unit),
    unit_price: num(l.unit_price),
    amount: num(l.amount)
  };
});
const transcribed = (typeof d.raw_text === 'string' && d.raw_text.trim()) ? d.raw_text.trim() : null;
const ticket = {
  status: 'pendiente',
  captured_at: build.captured_at || null,
  purchased_at: date(d.purchased_at),
  store_name: str(d.store_name),
  ticket_number: str(d.ticket_number),
  subtotal: num(d.subtotal),
  total: num(d.total),
  raw_text: transcribed || build.raw_text || null,
  image_key: up.key || build.key || null,
  image_url: up.url || null,
  notes: null
};
return [{ json: { ticket: ticket, lines: lines } }];`
    },
    position: [1400, 4300]
  },
  output: [{ ticket: { store_name: 'MERCADONA', total: 12.5 }, lines: [{ line_no: 1, product_name: 'Leche', amount: 1.05 }] }]
});

const photo_dbCreate = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'photo – DB Create',
    parameters: {
      method: 'POST',
      url: photo_INS_FORGE_BASE + '/api/database/rpc/photo_ticket_create',
      sendHeaders: true,
      headerParameters: photo_INS_FORGE_HEADERS,
      sendBody: true,
      specifyBody: 'json',
      jsonBody: "={{ JSON.stringify({ p_ticket: $json.ticket, p_lines: $json.lines }) }}",
      options: {}
    },
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    position: [1640, 4300]
  },
  output: [{ id: '00000000-0000-0000-0000-000000000000' }]
});

const photo_respondOk = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'photo – Respond OK',
    parameters: {
      respondWith: 'json',
      responseBody: "={{ { ok: true, id: $json.id } }}"
    },
    position: [1880, 4260]
  },
  output: [{ ok: true, id: '00000000-0000-0000-0000-000000000000' }]
});

const photo_respondUnauthorized = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'photo – Respond Unauthorized',
    parameters: {
      respondWith: 'json',
      responseBody: "={{ { ok: false, error: 'unauthorized' } }}",
      options: { responseCode: 401 }
    },
    position: [680, 4520]
  },
  output: [{ ok: false, error: 'unauthorized' }]
});

const mercB_INS_FORGE_BASE = 'https://insforge.benicolo.com';
const mercB_BUCKET = 'mercadona';

const mercB_startTrigger = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Start', position: [200, 5200] },
  output: [{}]
});

const mercB_listMessageIds = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'mercB – List Existing Message Ids',
    parameters: {
      method: 'POST',
      url: mercB_INS_FORGE_BASE + '/api/database/rpc/mercadona_ticket_message_ids',
      sendHeaders: true,
      headerParameters: INS_FORGE_HEADERS,
      options: {}
    },
    position: [420, 5200]
  },
  output: [{ ids: ['18f0000000000000'] }]
});

const mercB_listObjects = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'mercB – List Existing Objects',
    parameters: {
      method: 'GET',
      url: mercB_INS_FORGE_BASE + '/api/storage/buckets/' + mercB_BUCKET + '/objects?limit=1000',
      sendHeaders: true,
      headerParameters: INS_FORGE_HEADERS,
      options: {}
    },
    position: [640, 5200]
  },
  output: [{ data: [{ key: 'mercadona/example/ticket.pdf' }] }]
});

const mercB_getTickets = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'mercB – Get Tickets',
    parameters: {
      resource: 'message',
      operation: 'getAll',
      returnAll: true,
      simple: false,
      filters: {
        q: 'from:ticket_digital@mail.mercadona.com has:attachment filename:pdf',
        readStatus: 'both'
      },
      options: {
        downloadAttachments: true,
        dataPropertyAttachmentsPrefixName: 'attachment_'
      }
    },
    credentials: { gmailOAuth2: newCredential('Gmail account') },
    position: [860, 5200]
  },
  output: [{ id: '18f0000000000000', subject: 'Tu ticket Mercadona' }]
});

const mercB_expandPdfs = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'mercB – Expand PDFs',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const out = [];
for (const item of $input.all()) {
  const bin = item.binary || {};
  const id = (item.json && item.json.id) ? item.json.id : "unknown";
  for (const prop of Object.keys(bin)) {
    const meta = bin[prop];
    if (prop.indexOf("attachment_") === 0 && meta && meta.mimeType === "application/pdf") {
      const name = meta.fileName ? meta.fileName : (prop + ".pdf");
      const safeName = String(name).replace(/[^A-Za-z0-9._-]+/g, "_");
      out.push({
        json: {
          messageId: id,
          key: "mercadona/" + id + "/" + safeName,
          filename: name,
          mimeType: meta.mimeType,
          size: meta.fileSize || 0
        },
        binary: { data: bin[prop] }
      });
    }
  }
}
return out;`
    },
    position: [1080, 5200]
  },
  output: [{ key: 'mercadona/18f0000000000000/ticket.pdf', messageId: '18f0000000000000' }]
});

const mercB_extractPdf = node({
  type: 'n8n-nodes-base.extractFromFile',
  version: 1.1,
  config: {
    name: 'mercB – Extract PDF Text',
    parameters: {
      operation: 'pdf',
      binaryPropertyName: 'data',
      options: { keepSource: 'both' }
    },
    position: [1300, 5200]
  },
  output: [{ text: 'MERCADONA, S.A. ...' }]
});

const mercB_parseTicket = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'mercB – Parse Ticket',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `function num(s) {
  if (s === null || s === undefined) return null;
  var v = String(s).trim();
  if (!v) return null;
  if (v.indexOf(".") >= 0 && v.indexOf(",") >= 0) v = v.replace(/\\./g, "").replace(",", ".");
  else v = v.replace(",", ".");
  var n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function mercB_parseTicket(raw) {
  var text = String(raw === null || raw === undefined ? "" : raw);
  var t = { raw_text: text };
  var m;
  m = text.match(/FACTURA\\s+SIMPLIFICADA\\s*:\\s*([^\\n]+)/i);
  if (m) t.ticket_number = m[1].trim();
  m = text.match(/(\\d{2})\\/(\\d{2})\\/(\\d{4})\\s+(\\d{1,2}:\\d{2})/);
  if (m) t.purchased_at = m[3] + "-" + m[2] + "-" + m[1] + "T" + m[4] + ":00";
  m = text.match(/\\bOP\\s*:\\s*(\\d+)/i);
  if (m) t.operator_code = m[1];
  m = text.match(/\\b([A-Z]-\\d{8})\\b/);
  if (m) t.store_cif = m[1];
  m = text.match(/TEL[^\\n:]*:\\s*([\\d ]+)/i);
  if (m) t.store_phone = m[1].replace(/\\s+/g, "");
  var lines = text.replace(/\\r/g, "").split("\\n");
  var first = "";
  for (var j = 0; j < lines.length; j++) { if (lines[j].trim()) { first = lines[j].trim(); break; } }
  m = first.match(/^(.*?)\\s+([A-Z]-\\d{8})\\s*$/);
  if (m) { t.store_name = m[1].trim(); t.store_cif = t.store_cif || m[2]; } else { t.store_name = first; }
  var pcIdx = -1;
  for (var k = 0; k < lines.length; k++) { if (/^\\s*\\d{5}\\s+\\S/.test(lines[k])) { pcIdx = k; break; } }
  if (pcIdx >= 0) {
    m = lines[pcIdx].match(/^\\s*(\\d{5})\\s+(.+?)\\s*$/);
    if (m) { t.store_postal_code = m[1]; t.store_city = m[2]; }
    if (pcIdx > 0) t.store_address = lines[pcIdx - 1].trim();
  }
  m = text.match(/ENTRADA\\s+(\\d{1,2}:\\d{2})\\s+SALIDA\\s+(\\d{1,2}:\\d{2})/i);
  if (m) { t.entry_time = m[1]; t.exit_time = m[2]; }
  m = text.match(/^\\s*TOTAL\\s*(?:\\([^\\n]*\\))?\\s*([\\d.,]+)\\s*$/im);
  if (m) t.total = num(m[1]);
  m = text.match(/\\b(TARJETA BANCARIA|EFECTIVO|VISA|MASTERCARD|MET[\\u00C1A]LICO)\\b/i);
  if (m) t.payment_method = m[1].toUpperCase();
  m = text.match(/\\*{3,}\\s*\\*{3,}\\s*\\*{3,}\\s*(\\d{4})/);
  if (m) t.card_last4 = m[1];
  m = text.match(/N\\.?\\s*C\\s*:\\s*([A-Za-z0-9\\-]+)/i);
  if (m) t.nc = m[1];
  m = text.match(/AUT\\s*:\\s*([A-Za-z0-9\\-]+)/i);
  if (m) t.auth_code = m[1];
  var vats = [];
  var ivaStart = -1;
  for (var q = 0; q < lines.length; q++) {
    var lq = lines[q].trim();
    if (/^IVA\\b/i.test(lq) || /BASE\\s+IMPONIBLE/i.test(lq)) { ivaStart = q; break; }
  }
  if (ivaStart >= 0) {
    for (var r = ivaStart + 1; r < lines.length; r++) {
      var lv = lines[r].trim();
      if (!lv) continue;
      if (/^TOTAL\\b/i.test(lv)) break;
      var mm = lv.match(/^(\\d{1,2})\\s*%\\s+([\\d.,]+)\\s+([\\d.,]+)(?:\\s+([\\d.,]+))?\\s*$/);
      if (mm) vats.push({ rate: parseInt(mm[1], 10), base: num(mm[2]), amount: num(mm[3]) });
      else if (!/^\\d/.test(lv)) break;
    }
  }
  if (vats.length) {
    t.vat_summary = vats;
    var sbase = 0;
    for (var v = 0; v < vats.length; v++) sbase += (vats[v].base || 0);
    t.subtotal = Math.round(sbase * 100) / 100;
  }
  var items = [];
  var start = -1;
  for (var p = 0; p < lines.length; p++) { if (/Descripci[o\\u00F3]n.*(P\\.?\\s*Unit|Importe)/i.test(lines[p])) { start = p; break; } }
  for (var i = (start >= 0 ? start + 1 : 0); i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    if (/^(ENTRADA|TOTAL|TARJETA|TARJ\\.|IVA|N\\.?\\s*C\\s*:|AID:|SE ADMITEN|DISPONE|PARA RETIRAR|Importe:)/i.test(line)) break;
    var tokens = line.split(/\\s+/);
    var qty = num(tokens[0]);
    if (qty === null) continue;
    var nums = [];
    var kk = tokens.length - 1;
    while (kk >= 1 && /^\\d+([.,]\\d+)?$/.test(tokens[kk])) { nums.unshift(tokens[kk]); kk--; }
    if (!nums.length) {
      var nameOnly = tokens.slice(1).join(" ").trim();
      var nl = (lines[i + 1] || "").trim();
      var wm2 = nl.match(/^([\\d.,]+)\\s*(kg|g)\\s+([\\d.,]+)\\s*\\u20AC?\\s*\\/\\s*(kg|g)\\s+([\\d.,]+)\\s*$/i);
      if (wm2) {
        var wq = num(wm2[1]);
        items.push({ line_no: items.length + 1, product_name: nameOnly, quantity: wq, unit: wm2[2].toLowerCase(), unit_price: num(wm2[3]), weight_kg: wq, amount: num(wm2[5]) });
        i = i + 1;
      }
      continue;
    }
    var amount = num(nums[nums.length - 1]);
    var unitPrice = null;
    var consume = 1;
    if (nums.length >= 2 && qty !== 1) {
      var cand = num(nums[nums.length - 2]);
      if (cand !== null && Math.abs(cand * qty - amount) < 0.02) { unitPrice = cand; consume = 2; }
    }
    var nameEnd = tokens.length - consume;
    var name = tokens.slice(1, nameEnd).join(" ").trim();
    var unit = "ud";
    var weight = null;
    for (var u = 0; u < tokens.length; u++) {
      if (/^kg$/i.test(tokens[u]) || /^g$/i.test(tokens[u])) {
        unit = tokens[u].toLowerCase();
        if (u > 0 && /^\\d+([.,]\\d+)?$/.test(tokens[u - 1])) weight = num(tokens[u - 1]);
        break;
      }
    }
    items.push({ line_no: items.length + 1, product_name: name, quantity: qty, unit: unit, unit_price: unitPrice, weight_kg: weight, amount: amount });
  }
  t.items = items;
  t.item_count = items.length;
  return t;
}

var base = "https://insforge.benicolo.com";
var bucket = "mercadona";
var out = [];
var all = $input.all();
for (var idx = 0; idx < all.length; idx++) {
  var item = all[idx];
  var j = item.json || {};
  var text = j.text || j.data || j.content || "";
  var t = mercB_parseTicket(text);
  var messageId = j.messageId || j.id || null;
  var key = j.key || null;
  var payload = {
    p_ticket: {
      message_id: messageId,
      ticket_number: t.ticket_number || null,
      purchased_at: t.purchased_at || null,
      store_name: t.store_name || null,
      store_cif: t.store_cif || null,
      store_address: t.store_address || null,
      store_postal_code: t.store_postal_code || null,
      store_city: t.store_city || null,
      store_phone: t.store_phone || null,
      operator_code: t.operator_code || null,
      entry_time: t.entry_time || null,
      exit_time: t.exit_time || null,
      item_count: t.item_count || null,
      subtotal: (t.subtotal === undefined ? null : t.subtotal),
      total: (t.total === undefined ? null : t.total),
      payment_method: t.payment_method || null,
      card_last4: t.card_last4 || null,
      nc: t.nc || null,
      auth_code: t.auth_code || null,
      vat_summary: t.vat_summary || null,
      pdf_key: key,
      pdf_url: key ? (base + "/api/storage/buckets/" + bucket + "/objects/" + encodeURIComponent(key)) : null,
      raw_text: t.raw_text
    },
    p_items: t.items
  };
  out.push({ json: { message_id: messageId, key: key, text_len: String(text).length, payload: payload }, binary: item.binary });
}
return out;`
    },
    position: [1520, 5200]
  },
  output: [{ message_id: '18f0000000000000', key: 'mercadona/18f0000000000000/ticket.pdf', text_len: 800 }]
});

const mercB_notInDb = node({
  type: 'n8n-nodes-base.filter',
  version: 2.2,
  config: {
    name: 'mercB – Not In DB',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [
          {
            leftValue: "={{ !($('mercB – List Existing Message Ids').first().json.ids || []).includes($json.message_id) }}",
            rightValue: true,
            operator: { type: 'boolean', operation: 'true', singleValue: true }
          }
        ],
        combinator: 'and'
      },
      options: {}
    },
    position: [1740, 5200]
  },
  output: [{ message_id: '18f0000000000000' }]
});

const mercB_dbUpsert = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'mercB – DB Upsert Ticket',
    parameters: {
      method: 'POST',
      url: mercB_INS_FORGE_BASE + '/api/database/rpc/mercadona_upsert_ticket',
      sendHeaders: true,
      headerParameters: INS_FORGE_HEADERS,
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json.payload) }}',
      options: {}
    },
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    position: [1960, 5200]
  },
  output: [{ id: '00000000-0000-0000-0000-000000000000', message_id: '18f0000000000000' }]
});

const mercB_reattach = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'mercB – Reattach PDF',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `var parsed = $('mercB – Parse Ticket').all();
var byId = {};
for (var i = 0; i < parsed.length; i++) {
  var pj = parsed[i].json || {};
  if (pj.message_id) byId[pj.message_id] = parsed[i];
}
var resp = $input.all();
var out = [];
for (var r = 0; r < resp.length; r++) {
  var j = resp[r].json || {};
  var src = byId[j.message_id];
  var key = j.pdf_key || (src && src.json ? src.json.key : null) || null;
  out.push({
    json: { message_id: j.message_id || null, ticket_id: j.id || null, key: key },
    binary: src ? src.binary : undefined
  });
}
return out;`
    },
    position: [2180, 5200]
  },
  output: [{ message_id: '18f0000000000000', key: 'mercadona/18f0000000000000/ticket.pdf' }]
});

const mercB_notInStorage = node({
  type: 'n8n-nodes-base.filter',
  version: 2.2,
  config: {
    name: 'mercB – Not In Storage',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [
          {
            leftValue: "={{ !($('mercB – List Existing Objects').first().json.data || []).some(o => o.key === $json.key) }}",
            rightValue: true,
            operator: { type: 'boolean', operation: 'true', singleValue: true }
          }
        ],
        combinator: 'and'
      },
      options: {}
    },
    position: [2400, 5200]
  },
  output: [{ key: 'mercadona/18f0000000000000/ticket.pdf' }]
});

const mercB_uploadPdf = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'mercB – Upload to InsForge',
    parameters: {
      method: 'PUT',
      url: '=' + mercB_INS_FORGE_BASE + '/api/storage/buckets/' + mercB_BUCKET + '/objects/{{ encodeURIComponent($json.key) }}',
      sendHeaders: true,
      headerParameters: INS_FORGE_HEADERS,
      sendBody: true,
      contentType: 'multipart-form-data',
      bodyParameters: {
        parameters: [
          { parameterType: 'formBinaryData', name: 'file', inputDataFieldName: 'data' }
        ]
      },
      options: {}
    },
    retryOnFail: true,
    maxTries: 4,
    waitBetweenTries: 3000,
    onError: 'continueRegularOutput',
    position: [2620, 5200]
  },
  output: [{ key: 'mercadona/18f0000000000000/ticket.pdf' }]
});

const ibeB_INS_FORGE_BASE = 'https://insforge.benicolo.com';
const ibeB_BUCKET = 'iberdrola';

const ibeB_startTrigger = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Start', position: [200, 6000] },
  output: [{}]
});

const ibeB_listMessageIds = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'ibeB – List Existing Message Ids',
    parameters: {
      method: 'POST',
      url: ibeB_INS_FORGE_BASE + '/api/database/rpc/iberdrola_invoice_message_ids',
      sendHeaders: true,
      headerParameters: INS_FORGE_HEADERS,
      options: {}
    },
    position: [420, 6000]
  },
  output: [{ ids: ['18f0000000000000'] }]
});

const ibeB_listObjects = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'ibeB – List Existing Objects',
    parameters: {
      method: 'GET',
      url: ibeB_INS_FORGE_BASE + '/api/storage/buckets/' + ibeB_BUCKET + '/objects?limit=1000',
      sendHeaders: true,
      headerParameters: INS_FORGE_HEADERS,
      options: {}
    },
    position: [640, 6000]
  },
  output: [{ data: [{ key: 'iberdrola/example/factura.pdf' }] }]
});

const ibeB_getInvoices = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'ibeB – Get Invoices',
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
    position: [860, 6000]
  },
  output: [{ id: '18f0000000000000', subject: 'Tu factura de luz' }]
});

const ibeB_expandPdfs = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'ibeB – Expand PDFs',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "const out = [];\nfor (const item of $input.all()) {\n  const bin = item.binary || {};\n  const id = (item.json && item.json.id) ? item.json.id : \"unknown\";\n  for (const prop of Object.keys(bin)) {\n    const meta = bin[prop];\n    if (prop.indexOf(\"attachment_\") === 0 && meta && meta.mimeType === \"application/pdf\") {\n      const name = meta.fileName ? meta.fileName : (prop + \".pdf\");\n      const safeName = String(name).replace(/[^A-Za-z0-9._-]+/g, \"_\");\n      out.push({\n        json: { messageId: id, filename: name, mimeType: meta.mimeType, size: meta.fileSize || 0, safeName: safeName },\n        binary: { data: bin[prop] }\n      });\n    }\n  }\n}\nreturn out;" },
    position: [1080, 6000]
  },
  output: [{ messageId: '18f0000000000000', filename: 'factura.pdf', safeName: 'factura.pdf' }]
});

const ibeB_extractPdf = node({
  type: 'n8n-nodes-base.extractFromFile',
  version: 1.1,
  config: {
    name: 'ibeB – Extract PDF Text',
    parameters: { operation: 'pdf', binaryPropertyName: 'data', options: { keepSource: 'both' } },
    onError: 'continueRegularOutput',
    position: [1300, 6000]
  },
  output: [{ text: 'FACTURA DE ELECTRICIDAD ...' }]
});

const ibeB_parseInvoice = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'ibeB – Parse Iberdrola',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "function norm(s) {\n  return String(s == null ? \"\" : s).replace(/\\uFB01/g, \"fi\").replace(/\\uFB02/g, \"fl\");\n}\nfunction esNum(s) {\n  if (s == null) return null;\n  var v = String(s).trim().replace(/\\s/g, \"\");\n  if (!v) return null;\n  if (v.indexOf(\",\") >= 0) v = v.replace(/\\./g, \"\").replace(\",\", \".\");\n  var n = parseFloat(v);\n  return isNaN(n) ? null : n;\n}\nfunction pad(n) {\n  return String(n).padStart(2, \"0\");\n}\nfunction round2(n) {\n  return n == null ? null : Math.round(n * 100) / 100;\n}\nfunction isoDate(s) {\n  var m = String(s || \"\").trim().match(/^(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})$/);\n  return m ? m[3] + \"-\" + pad(m[2]) + \"-\" + pad(m[1]) : null;\n}\nvar MONTHS = {\n  enero: \"01\", febrero: \"02\", marzo: \"03\", abril: \"04\", mayo: \"05\", junio: \"06\",\n  julio: \"07\", agosto: \"08\", septiembre: \"09\", setiembre: \"09\", octubre: \"10\", noviembre: \"11\", diciembre: \"12\"\n};\nfunction isoLongDate(s) {\n  var m = String(s || \"\").trim().match(/^(\\d{1,2}) de ([a-z\\u00e1\\u00e9\\u00ed\\u00f3\\u00fa]+) de (\\d{4})$/i);\n  if (!m) return null;\n  var mo = MONTHS[m[2].toLowerCase()];\n  return mo ? m[3] + \"-\" + mo + \"-\" + pad(m[1]) : null;\n}\n\nfunction parseIberdrola(rawText) {\n  var text = norm(rawText);\n  var t = { raw_text: text };\n  var m;\n  m = text.match(/Nº FACTURA:\\s*(\\d{17})/); if (m) t.invoice_number = m[1];\n  m = text.match(/Nº DE CONTRATO:\\s*(\\d+)/); if (m) t.contract_number = m[1];\n  m = text.match(/PERIODO DE FACTURACIÓN:\\s*(\\d{2}\\/\\d{2}\\/\\d{4})\\s*-\\s*(\\d{2}\\/\\d{2}\\/\\d{4})/);\n  if (m) { t.period_start = isoDate(m[1]); t.period_end = isoDate(m[2]); }\n  m = text.match(/FECHA DE EMISIÓN:\\s*([^\\n]+)/); if (m) t.issue_date = isoLongDate(m[1]);\n  m = text.match(/FECHA PREVISTA DE COBRO:\\s*(\\d{2}\\/\\d{2}\\/\\d{4})/); if (m) t.due_date = isoDate(m[1]);\n  m = text.match(/DIAS FACTURADOS:\\s*(\\d+)/); if (m) t.days_billed = parseInt(m[1], 10);\n  m = text.match(/TOTAL\\s*\\n\\s*([\\d.]+,\\d{2})\\s*€/); if (m) t.total = esNum(m[1]);\n  m = text.match(/ENERGÍA\\.{3,}\\s*([\\d.]+,\\d{2})\\s*€/); if (m) t.energy_amount = esNum(m[1]);\n  m = text.match(/CARGOS NORMATIVOS\\s*\\.{3,}\\s*([\\d.]+,\\d{2})\\s*€/); if (m) t.charges_amount = esNum(m[1]);\n  m = text.match(/SERVICIOS Y OTROS CONCEPTOS\\.{3,}\\s*([\\d.]+,\\d{2})\\s*€/); if (m) t.services_amount = esNum(m[1]);\n  m = text.match(/IVA\\.{3,}\\s*([\\d.]+,\\d{2})\\s*€/); if (m) t.tax_amount = esNum(m[1]);\n  if (t.total != null && t.tax_amount != null) t.subtotal = round2(t.total - t.tax_amount);\n  m = text.match(/Potencia punta:\\s*([\\d.,]+)\\s*kW\\s*Potencia valle:\\s*([\\d.,]+)\\s*kW/i);\n  if (m) { t.contracted_power_punta = esNum(m[1]); t.contracted_power_valle = esNum(m[2]); }\n  m = text.match(/\\b(\\d\\.\\dTD)\\b/); if (m) t.tariff = m[1];\n  m = text.match(/\\b(\\d{8}[A-Z])\\b/); if (m) t.nif = m[1];\n  m = text.match(/(ES\\s?\\d{4}\\s?\\d{4}\\s?\\d{4}\\s?\\d{4}\\s?[A-Z]{2})/); if (m) t.cups = m[1].trim();\n  m = text.match(/Titular\\s*\\n\\s*([^\\n]+)/); if (m) t.titular = m[1].trim();\n  m = text.match(/Dirección de suministro:\\s*\\n?\\s*([^\\n]+)/i);\n  if (m) {\n    t.supply_address = m[1].trim();\n    var city = t.supply_address.match(/\\b(\\d{5})\\s+([A-Za-zÁÉÍÓÚÑáéíóúñ\\s]+?)\\s*\\(/);\n    if (city) t.city = city[1] + \" \" + city[2].trim();\n    var street = t.supply_address.match(/C\\/\\s*([^,]+)/i);\n    if (street) t.contract_label = street[1].trim();\n  }\n\n  var consumption = [];\n  m = text.match(/consumos desagregados han sido punta:?\\s*([\\d.,]+)\\s*kWh;?\\s*llano:?\\s*([\\d.,]+)\\s*kWh;?\\s*valle:?\\s*([\\d.,]+)\\s*kWh/i);\n  if (m) {\n    consumption.push({ tramo: \"punta\", kwh: esNum(m[1]) }, { tramo: \"llano\", kwh: esNum(m[2]) }, { tramo: \"valle\", kwh: esNum(m[3]) });\n    t.consumption_kwh = round2((esNum(m[1]) || 0) + (esNum(m[2]) || 0) + (esNum(m[3]) || 0));\n  } else {\n    var g = text.match(/([\\d.,]+)\\s*kWh\\s*\\n\\s*[\\d.,]+\\s*€[\\s\\S]{0,40}?Consumo total/i);\n    if (g) t.consumption_kwh = esNum(g[1]);\n  }\n\n  var found = [];\n  var energyMatches = [];\n  function collect(re, fn) { var mm; while ((mm = re.exec(text)) !== null) found.push({ index: mm.index, data: fn(mm) }); }\n  collect(/(Punta|Valle)\\s+([\\d.,]+)\\s*kW\\s*x\\s*(\\d+)\\s*d[ií]as\\s*x\\s*([\\d.,]+)\\s*€\\s*\\/\\s*kW\\s*d[ií]a/gi, function (mm) {\n    var qty = esNum(mm[2]), days = parseInt(mm[3], 10), price = esNum(mm[4]);\n    return { group: \"power\", line_type: \"potencia_\" + mm[1].toLowerCase(), tramo: mm[1].toLowerCase(), concept: \"Potencia \" + mm[1].toLowerCase(), detail: mm[0].trim(), quantity: qty, unit: \"kW\", unit_price: price, days: days, amount: round2(qty * days * price) };\n  });\n  collect(/([\\d.,]+)\\s*kWh\\s*x\\s*([\\d.,]+)\\s*€\\s*\\/\\s*kWh/gi, function (mm) {\n    var qty = esNum(mm[1]), price = esNum(mm[2]);\n    var isFnee = price != null && price < 0.01;\n    var line = { group: \"energy\", line_type: isFnee ? \"energia_fnee\" : \"energia\", tramo: null, concept: isFnee ? \"Regularización FNEE\" : \"Energía consumida\", detail: mm[0].trim(), quantity: qty, unit: \"kWh\", unit_price: price, amount: round2(qty * price) };\n    energyMatches.push(line);\n    return line;\n  });\n  var dayLines = [];\n  collect(/(\\d+)\\s*d[ií]as\\s*x\\s*([\\d.,]+)\\s*€\\s*\\/\\s*d[ií]a/gi, function (mm) {\n    var days = parseInt(mm[1], 10), price = esNum(mm[2]);\n    var line = { group: \"charges\", line_type: \"bono_social\", concept: \"Financiación bono social fijo\", detail: mm[0].trim(), quantity: days, unit: \"días\", unit_price: price, days: days, amount: round2(days * price) };\n    dayLines.push(line);\n    return line;\n  });\n  collect(/([\\d.,]+)\\s*mes(?:es)?\\s*x\\s*([\\d.,]+)\\s*€\\s*\\/\\s*mes/gi, function (mm) {\n    var qty = esNum(mm[1]), price = esNum(mm[2]);\n    return { group: \"services\", line_type: \"proteccion_hogar\", concept: \"Protección Eléctrica Hogar\", detail: mm[0].trim(), quantity: qty, unit: \"meses\", unit_price: price, amount: round2(qty * price) };\n  });\n  collect(/([\\d.,]+)\\s*%\\s*s\\s*\\/\\s*([\\d.,]+)\\s*€/gi, function (mm) {\n    var rate = esNum(mm[1]), base = esNum(mm[2]);\n    var isIva = rate != null && rate > 7;\n    return { group: \"taxes\", line_type: isIva ? \"iva\" : \"impuesto_electricidad\", concept: isIva ? \"IVA\" : \"Impuesto sobre electricidad\", detail: mm[0].trim(), unit: \"%\", unit_price: null, vat_rate: rate, tax_base: base, amount: round2((rate / 100) * base) };\n  });\n  for (var d = 0; d < dayLines.length; d++) {\n    if (d === 1) { dayLines[d].group = \"services\"; dayLines[d].line_type = \"alquiler_contador\"; dayLines[d].concept = \"Alquiler equipos medida\"; }\n  }\n  found.sort(function (a, b) { return a.index - b.index; });\n  var lines = found.map(function (f, i) { var o = f.data; o.line_no = i + 1; return o; });\n  if (t.consumption_kwh == null && energyMatches.length) {\n    var s = 0;\n    for (var e = 0; e < energyMatches.length; e++) s += (energyMatches[e].quantity || 0);\n    t.consumption_kwh = round2(s);\n  }\n  t.lines = lines;\n  return { header: t, lines: lines, consumption: consumption };\n}\n\n\nvar base = \"https://insforge.benicolo.com\"; var bucket = \"iberdrola\";\nvar out = []; var all = $input.all();\nfor (var idx = 0; idx < all.length; idx++) {\n  var item = all[idx]; var j = item.json || {};\n  var text = j.text || j.data || j.content || \"\";\n  var r = parseIberdrola(text); var h = r.header;\n  if (!h.invoice_number) continue;\n  var messageId = j.messageId || j.id || null;\n  var key = \"iberdrola/\" + (h.contract_number || \"unknown\") + \"/\" + (h.invoice_number || messageId || \"factura\") + \".pdf\";\n  var payload = {\n    p_invoice: {\n      message_id: messageId,\n      contract_number: h.contract_number || null,\n      contract_label: h.contract_label || null,\n      invoice_number: h.invoice_number || null,\n      issue_date: h.issue_date || null,\n      period_start: h.period_start || null,\n      period_end: h.period_end || null,\n      due_date: h.due_date || null,\n      tariff: h.tariff || null,\n      days_billed: (h.days_billed == null ? null : String(h.days_billed)),\n      total: h.total,\n      subtotal: h.subtotal,\n      energy_amount: h.energy_amount,\n      charges_amount: h.charges_amount,\n      services_amount: h.services_amount,\n      tax_amount: h.tax_amount,\n      consumption_kwh: h.consumption_kwh,\n      cups: h.cups || null,\n      supply_address: h.supply_address || null,\n      city: h.city || null,\n      titular: h.titular || null,\n      nif: h.nif || null,\n      contracted_power_punta: h.contracted_power_punta,\n      contracted_power_valle: h.contracted_power_valle,\n      pdf_key: key,\n      pdf_url: base + \"/api/storage/buckets/\" + bucket + \"/objects/\" + encodeURIComponent(key),\n      raw_text: h.raw_text\n    },\n    p_lines: r.lines,\n    p_consumption: r.consumption\n  };\n  out.push({ json: { message_id: messageId, key: key, invoice_number: h.invoice_number, contract_number: h.contract_number, total: h.total, lines_count: r.lines.length, payload: payload }, binary: item.binary });\n}\nreturn out;\n" },
    position: [1520, 6000]
  },
  output: [{ message_id: '18f0000000000000', key: 'iberdrola/279914829/21240222010006319.pdf', lines_count: 9 }]
});

const ibeB_notInDb = node({
  type: 'n8n-nodes-base.filter',
  version: 2.2,
  config: {
    name: 'ibeB – Not In DB',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [
          {
            leftValue: "={{ !($('ibeB – List Existing Message Ids').first().json.ids || []).includes($json.message_id) }}",
            rightValue: true,
            operator: { type: 'boolean', operation: 'true', singleValue: true }
          }
        ],
        combinator: 'and'
      },
      options: {}
    },
    position: [1740, 6000]
  },
  output: [{ message_id: '18f0000000000000' }]
});

const ibeB_dbUpsert = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'ibeB – DB Upsert Invoice',
    parameters: {
      method: 'POST',
      url: ibeB_INS_FORGE_BASE + '/api/database/rpc/iberdrola_upsert_invoice',
      sendHeaders: true,
      headerParameters: INS_FORGE_HEADERS,
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json.payload) }}',
      options: {}
    },
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    position: [1960, 6000]
  },
  output: [{ id: '00000000-0000-0000-0000-000000000000', invoice_number: '21240222010006319' }]
});

const ibeB_reattach = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'ibeB – Reattach PDF',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "var parsed = $('ibeB – Parse Iberdrola').all();\nvar byInv = {};\nfor (var i = 0; i < parsed.length; i++) { var pj = parsed[i].json || {}; if (pj.invoice_number) byInv[pj.invoice_number] = parsed[i]; }\nvar resp = $input.all(); var out = [];\nfor (var r = 0; r < resp.length; r++) {\n  var j = resp[r].json || {};\n  var src = byInv[j.invoice_number];\n  out.push({ json: { invoice_id: j.id || null, key: src ? (src.json.key || null) : null }, binary: src ? src.binary : undefined });\n}\nreturn out;" },
    position: [2180, 6000]
  },
  output: [{ invoice_id: '00000000-0000-0000-0000-000000000000', key: 'iberdrola/279914829/21240222010006319.pdf' }]
});

const ibeB_notInStorage = node({
  type: 'n8n-nodes-base.filter',
  version: 2.2,
  config: {
    name: 'ibeB – Not In Storage',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [
          {
            leftValue: "={{ !($('ibeB – List Existing Objects').first().json.data || []).some(o => o.key === $json.key) }}",
            rightValue: true,
            operator: { type: 'boolean', operation: 'true', singleValue: true }
          }
        ],
        combinator: 'and'
      },
      options: {}
    },
    position: [2400, 6000]
  },
  output: [{ key: 'iberdrola/279914829/21240222010006319.pdf' }]
});

const ibeB_uploadPdf = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'ibeB – Upload to InsForge',
    parameters: {
      method: 'PUT',
      url: '=' + ibeB_INS_FORGE_BASE + '/api/storage/buckets/' + ibeB_BUCKET + '/objects/{{ encodeURIComponent($json.key) }}',
      sendHeaders: true,
      headerParameters: INS_FORGE_HEADERS,
      sendBody: true,
      contentType: 'multipart-form-data',
      bodyParameters: { parameters: [{ parameterType: 'formBinaryData', name: 'file', inputDataFieldName: 'data' }] },
      options: {}
    },
    retryOnFail: true,
    maxTries: 4,
    waitBetweenTries: 3000,
    onError: 'continueRegularOutput',
    position: [2620, 6000]
  },
  output: [{ key: 'iberdrola/279914829/21240222010006319.pdf' }]
});

const wayB_INS_FORGE_BASE = 'https://insforge.benicolo.com';
const wayB_BUCKET = 'waylet';

const wayB_startTrigger = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Start', position: [200, 6800] },
  output: [{}]
});

const wayB_listMessageIds = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'wayB – List Existing Message Ids',
    parameters: {
      method: 'POST',
      url: wayB_INS_FORGE_BASE + '/api/database/rpc/waylet_ticket_message_ids',
      sendHeaders: true,
      headerParameters: INS_FORGE_HEADERS,
      options: {}
    },
    position: [420, 6800]
  },
  output: [{ ids: ['18f0000000000000'] }]
});

const wayB_listObjects = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'wayB – List Existing Objects',
    parameters: {
      method: 'GET',
      url: wayB_INS_FORGE_BASE + '/api/storage/buckets/' + wayB_BUCKET + '/objects?limit=1000',
      sendHeaders: true,
      headerParameters: INS_FORGE_HEADERS,
      options: {}
    },
    position: [640, 6800]
  },
  output: [{ data: [{ key: 'waylet/example.pdf' }] }]
});

const wayB_getTickets = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'wayB – Get Tickets',
    parameters: {
      resource: 'message',
      operation: 'getAll',
      returnAll: true,
      simple: false,
      filters: { q: 'from:benicolo@gmail.com subject:Waylet', readStatus: 'both' },
      options: {}
    },
    credentials: { gmailOAuth2: newCredential('Gmail account') },
    position: [860, 6800]
  },
  output: [{ id: '18f0000000000000', subject: 'Waylet - ES GLEM S.L COCENTAINA' }]
});

const wayB_extractLink = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'wayB – Extract link',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "var out = [];\nvar items = $input.all();\nfor (var i = 0; i < items.length; i++) {\n  var j = items[i].json || {};\n  var body = String(j.html || j.text || j.body || \"\");\n  var m = body.match(/https:\\/\\/waylet\\.repsol\\.everiscloudpayments\\.com\\/waylet\\/api\\/public\\/klikin\\/ticket-services\\/v1\\/ticket\\/[A-Za-z0-9]+/);\n  if (!m) continue;\n  var subject = j.subject || (j.headers && j.headers.subject) || \"\";\n  var lm = String(subject).match(/Waylet\\s*-\\s*ES GLEM S\\.?L\\.?\\s+(.+)$/i);\n  out.push({ json: { messageId: j.id || null, subject: subject, locality: lm ? lm[1].trim() : null, url: m[0] } });\n}\nreturn out;" },
    position: [1080, 6800]
  },
  output: [{ messageId: '18f0000000000000', locality: 'COCENTAINA', url: 'https://...' }]
});

const wayB_downloadPdf = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'wayB – Download PDF',
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
    position: [1300, 6800]
  },
  output: [{ data: {} }]
});

const wayB_extractPdf = node({
  type: 'n8n-nodes-base.extractFromFile',
  version: 1.1,
  config: {
    name: 'wayB – Extract PDF Text',
    parameters: { operation: 'pdf', binaryPropertyName: 'data', options: { keepSource: 'both' } },
    onError: 'continueRegularOutput',
    position: [1520, 6800]
  },
  output: [{ text: 'ES GLEM SL ...' }]
});

const wayB_parseWaylet = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'wayB – Parse Waylet',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "function norm(s) {\n  return String(s == null ? \"\" : s).replace(/\\uFB01/g, \"fi\").replace(/\\uFB02/g, \"fl\");\n}\nfunction esNum(s) {\n  if (s == null) return null;\n  var v = String(s).trim().replace(/\\s/g, \"\").replace(/€/g, \"\");\n  if (!v) return null;\n  if (v.indexOf(\",\") >= 0) v = v.replace(/\\./g, \"\").replace(\",\", \".\");\n  var n = parseFloat(v);\n  return isNaN(n) ? null : n;\n}\n\nfunction wayB_parseWaylet(rawText) {\n  var text = norm(rawText);\n  var t = { raw_text: text };\n  var m;\n  var discountLabel = null;\n\n  // Station + address + postal code / locality\n  m = text.match(/(ES\\s+GLEM\\s+S\\.?L\\.?)/i);\n  if (m) t.station_name = m[1].replace(/\\s+/g, \" \").trim();\n  else {\n    m = text.match(/(GLEM\\s+S\\.?L\\.?)/i);\n    if (m) t.station_name = m[1].trim();\n  }\n  m = text.match(/(C\\/|CL)\\s+[^\\n]+/);\n  if (m) t.address = m[0].trim();\n  m = text.match(/(\\d{5})\\s*-\\s*([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑ ]+)/);\n  if (m) {\n    t.postal_code = m[1];\n    t.locality = m[2].trim();\n  }\n\n  // Date + time\n  m = text.match(/Fecha:\\s*(\\d{2})-(\\d{2})-(\\d{4})/);\n  var fecha = m ? m[3] + \"-\" + m[2] + \"-\" + m[1] : null;\n  m = text.match(/Hora:\\s*(\\d{2}:\\d{2}(?::\\d{2})?)/);\n  var hora = m ? m[1] : null;\n  t.purchased_at = fecha ? fecha + \"T\" + (hora ? (hora.length === 5 ? hora + \":00\" : hora) : \"00:00:00\") : null;\n\n  // Product table.\n  // Layout A (n8n Extract): columns preserved on one header line\n  //   PRODUCTO €/L LITROS IMPORTE\n  //   Diesel e+ 1,939 25,78 49,99\n  m = text.match(/PRODUCTO\\s+€\\/L\\s+LITROS\\s+IMPORTE\\s*\\n\\s*([^\\n]+?)\\s+(-?[\\d.,]+)\\s+(-?[\\d.,]+)\\s+(-?[\\d.,]+)/i);\n  if (m) {\n    t.fuel_type = m[1].trim();\n    t.unit_price = esNum(m[2]);\n    t.liters = esNum(m[3]);\n    t.gross_amount = esNum(m[4]);\n    var rest = text.slice(m.index + m[0].length);\n    var dm = rest.match(/\\n\\s*([^\\n]+?)\\s+(-[\\d.,]+)\\s*\\n/);\n    if (dm && !/Total/i.test(dm[1])) discountLabel = dm[1].trim();\n    if (dm && !/Total/i.test(dm[1])) t.discount_amount = Math.abs(esNum(dm[2]));\n  } else {\n    // Layout B (pdftotext): columns stacked\n    m = text.match(/PRODUCTO\\s*€\\/L\\s*([^\\n]+)\\s+([\\d.,]+)/i);\n    if (m) {\n      t.fuel_type = m[1].trim();\n      t.unit_price = esNum(m[2]);\n    }\n    m = text.match(/LITROS\\s*([\\d.,]+)/i);\n    if (m) t.liters = esNum(m[1]);\n    m = text.match(/([^\\n]+)\\n\\s*LITROS/i);\n    if (m && m[1] && !/^[\\d.,\\s]+$/.test(m[1])) discountLabel = m[1].trim();\n    m = text.match(/IMPORTE\\s+(-?[\\d.,]+)\\s+(-?[\\d.,]+)/i);\n    if (m) {\n      t.gross_amount = esNum(m[1]);\n      t.discount_amount = Math.abs(esNum(m[2]));\n    }\n  }\n\n  // Totals\n  m = text.match(/Total descuento:\\s*([\\d.,]+)\\s*€/i);\n  if (m && (t.discount_amount == null || t.discount_amount === 0)) t.discount_amount = Math.abs(esNum(m[1]));\n  m = text.match(/Total Venta:\\s*([\\d.,]+)\\s*€/i);\n  if (m) t.total = esNum(m[1]);\n  if (t.total == null) {\n    m = text.match(/Total tarjeta:\\s*([\\d.,]+)\\s*€/i);\n    if (m) t.total = esNum(m[1]);\n  }\n\n  // Payment\n  m = text.match(/Pago Waylet\\s+(.+?)\\s*\\*+(\\d{4})/i);\n  if (m) {\n    t.payment_method = m[1].replace(/\\s+/g, \" \").trim();\n    t.card_last4 = m[2];\n  }\n\n  // Ticket number + waylet id\n  m = text.match(/N\\.?\\s*de ticket\\s*(\\d+)/i);\n  if (m) t.ticket_number = m[1];\n  m = text.match(/Id:\\s*([0-9a-fA-F-]{36})/);\n  if (m) t.waylet_id = m[1];\n\n  // Lines (primary fuel + discount / other products)\n  var lines = [];\n  if (t.fuel_type || t.gross_amount != null) {\n    lines.push({ product_name: t.fuel_type || \"Combustible\", unit_price: t.unit_price, amount: t.gross_amount });\n  }\n  if (t.discount_amount != null && t.discount_amount > 0) {\n    lines.push({ product_name: discountLabel || \"Descuento\", unit_price: null, amount: -t.discount_amount });\n  }\n\n  return { header: t, lines: lines };\n}\n\n\nvar base = \"https://insforge.benicolo.com\"; var bucket = \"waylet\";\nvar meta = $('wayB – Extract link').all();\nvar items = $input.all(); var out = [];\nfor (var i = 0; i < items.length; i++) {\n  var item = items[i]; var j = item.json || {};\n  var text = j.text || j.data || \"\";\n  var r = wayB_parseWaylet(text); var h = r.header;\n  if (!h.ticket_number) continue;\n  var mi = meta[i] ? (meta[i].json || {}) : {};\n  var messageId = mi.messageId || j.id || null;\n  var locality = h.locality || mi.locality || null;\n  var key = \"waylet/\" + (h.ticket_number || messageId || \"ticket\") + \".pdf\";\n  var payload = {\n    p_ticket: {\n      message_id: messageId,\n      waylet_id: h.waylet_id || null,\n      ticket_number: h.ticket_number,\n      purchased_at: h.purchased_at || null,\n      station_name: h.station_name || null,\n      address: h.address || null,\n      postal_code: h.postal_code || null,\n      locality: locality,\n      fuel_type: h.fuel_type || null,\n      liters: h.liters,\n      unit_price: h.unit_price,\n      gross_amount: h.gross_amount,\n      discount_amount: h.discount_amount,\n      total: h.total,\n      payment_method: h.payment_method || null,\n      card_last4: h.card_last4 || null,\n      vehicle_plate: h.vehicle_plate || null,\n      points: h.points,\n      pdf_key: key,\n      pdf_url: base + \"/api/storage/buckets/\" + bucket + \"/objects/\" + encodeURIComponent(key),\n      raw_text: h.raw_text\n    },\n    p_lines: r.lines\n  };\n  out.push({ json: { message_id: messageId, key: key, ticket_number: h.ticket_number, locality: locality, payload: payload }, binary: item.binary });\n}\nreturn out;\n" },
    position: [1740, 6800]
  },
  output: [{ ticket_number: '262400250757', key: 'waylet/262400250757.pdf' }]
});

const wayB_notInDb = node({
  type: 'n8n-nodes-base.filter',
  version: 2.2,
  config: {
    name: 'wayB – Not In DB',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [
          {
            leftValue: "={{ !($('wayB – List Existing Message Ids').first().json.ids || []).includes($json.message_id) }}",
            rightValue: true,
            operator: { type: 'boolean', operation: 'true', singleValue: true }
          }
        ],
        combinator: 'and'
      },
      options: {}
    },
    position: [1960, 6800]
  },
  output: [{ message_id: '18f0000000000000' }]
});

const wayB_dbUpsert = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'wayB – DB Upsert Ticket',
    parameters: {
      method: 'POST',
      url: wayB_INS_FORGE_BASE + '/api/database/rpc/waylet_upsert_ticket',
      sendHeaders: true,
      headerParameters: INS_FORGE_HEADERS,
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json.payload) }}',
      options: {}
    },
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    position: [2180, 6800]
  },
  output: [{ id: '00000000-0000-0000-0000-000000000000', ticket_number: '262400250757' }]
});

const wayB_reattach = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'wayB – Reattach PDF',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "var parsed = $('wayB – Parse Waylet').all();\nvar byTicket = {};\nfor (var i = 0; i < parsed.length; i++) { var pj = parsed[i].json || {}; if (pj.ticket_number) byTicket[pj.ticket_number] = parsed[i]; }\nvar resp = $input.all(); var out = [];\nfor (var r = 0; r < resp.length; r++) {\n  var j = resp[r].json || {};\n  var src = byTicket[j.ticket_number];\n  out.push({ json: { ticket_id: j.id || null, key: src ? (src.json.key || null) : null }, binary: src ? src.binary : undefined });\n}\nreturn out;" },
    position: [2400, 6800]
  },
  output: [{ ticket_id: '00000000-0000-0000-0000-000000000000', key: 'waylet/262400250757.pdf' }]
});

const wayB_notInStorage = node({
  type: 'n8n-nodes-base.filter',
  version: 2.2,
  config: {
    name: 'wayB – Not In Storage',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [
          {
            leftValue: "={{ !($('wayB – List Existing Objects').first().json.data || []).some(o => o.key === $json.key) }}",
            rightValue: true,
            operator: { type: 'boolean', operation: 'true', singleValue: true }
          }
        ],
        combinator: 'and'
      },
      options: {}
    },
    position: [2620, 6800]
  },
  output: [{ key: 'waylet/262400250757.pdf' }]
});

const wayB_uploadPdf = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'wayB – Upload to InsForge',
    parameters: {
      method: 'PUT',
      url: '=' + wayB_INS_FORGE_BASE + '/api/storage/buckets/' + wayB_BUCKET + '/objects/{{ encodeURIComponent($json.key) }}',
      sendHeaders: true,
      headerParameters: INS_FORGE_HEADERS,
      sendBody: true,
      contentType: 'multipart-form-data',
      bodyParameters: { parameters: [{ parameterType: 'formBinaryData', name: 'file', inputDataFieldName: 'data' }] },
      options: {}
    },
    retryOnFail: true,
    maxTries: 4,
    waitBetweenTries: 3000,
    onError: 'continueRegularOutput',
    position: [2840, 6800]
  },
  output: [{ key: 'waylet/262400250757.pdf' }]
});

const supB_INS_FORGE_BASE = 'https://insforge.benicolo.com';
const supB_BUCKET = 'suppliers';

const supB_parseCode = `function norm(s) {
  return String(s == null ? "" : s).replace(/\\uFB01/g, "fi").replace(/\\uFB02/g, "fl").replace(/\\u00a0/g, " ");
}
function esNum(s) {
  if (s == null) return null;
  var v = String(s).trim().replace(/\\s/g, "").replace(/€/g, "");
  if (!v) return null;
  if (v.indexOf(",") >= 0) v = v.replace(/\\./g, "").replace(",", ".");
  var n = parseFloat(v);
  return isNaN(n) ? null : n;
}
function isoDate(dmy) {
  var m = String(dmy || "").match(/(\\d{2})-(\\d{2})-(\\d{4})/);
  return m ? m[3] + "-" + m[2] + "-" + m[1] : null;
}
function parseAlbero(rawText) {
  var text = norm(rawText);
  var t = { raw_text: text };
  var m;
  t.supplier_name = "TRANSPORTES ALBERO S.L.";
  if (/B0?3075116/.test(text)) t.supplier_tax_id = "B03075116";
  m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/i);
  if (m) t.supplier_email = m[0];
  m = text.match(/\\b(9\\d{8})\\b/);
  if (m) t.supplier_phone = m[1];
  m = text.match(/CAE\\s+exp\\S*[\\s\\S]{0,60}?([A-Z]{2}\\d{3,}[A-Z0-9]+)/i);
  if (m) t.cae = m[1];
  m = text.match(/C\\.?\\s*R\\.?\\s*E\\.?\\s*([A-Z0-9]{6,})/i);
  if (m) t.cre = m[1];
  m = text.match(/Ref\\.?\\s*Local\\s*([A-Z0-9]+)/i);
  if (m) t.ref_local = m[1];
  m = text.match(/Factura:\\s*(\\d+)\\s*de\\s*(\\d{2}-\\d{2}-\\d{4})/i);
  if (m) { t.invoice_number = m[1]; t.issue_date = isoDate(m[2]); }
  if (!t.invoice_number) { m = text.match(/Factura[^\\d]{0,20}(\\d{3,})/i); if (m) t.invoice_number = m[1]; }
  m = text.match(/albar\\S{0,3}n:?\\s*(\\d{3,})/i);
  if (m) t.albaran = m[1];
  m = text.match(/pedido:\\s*([^\\n]*?)(?=\\s{2,}|Alb\\.|circu|\\n|$)/i);
  if (m) t.pedido = m[1].trim().replace(/\\s+/g, " ");
  m = text.match(/circu\\.?:?\\s*([A-Z0-9]+)/i);
  if (m) t.alb_circu = m[1];
  m = text.match(/Fecha de entrega\\s*(\\d{2}-\\d{2}-\\d{4})/i);
  if (m) t.delivery_date = isoDate(m[1]);
  m = text.match(/Nombre del producto\\s+([A-Z][A-Z0-9\\s.\\/-]{2,40})/i);
  if (!m) m = text.match(/Nombre del producto[^\\n]*\\n\\s*([A-Z][A-Z0-9\\s.\\/-]{2,40})/i);
  if (!m) m = text.match(/Producto\\s+([A-Z][A-Z0-9\\s.\\/-]{2,40})/);
  if (m) t.product = m[1].trim().replace(/\\s+/g, " ");
  m = text.match(/\\b(LTR|LT|KG|UD)\\b/);
  if (m) t.unit = m[1].toUpperCase();
  m = text.match(/LTR\\s+(\\d{1,7})/i) || text.match(/Cantidad\\s+(\\d{1,7})/i);
  if (m) t.quantity = esNum(m[1]);
  m = text.match(/(\\d{1,4},\\d{6})/);
  if (m) t.unit_price = esNum(m[1]);
  m = text.match(/IMPONIBLE:?\\s*([\\d.,]+)/i);
  if (m) t.base = esNum(m[1]);
  m = text.match(/%\\s*IVA\\s*([\\d.,]+)/i);
  if (m) t.vat_rate = esNum(m[1]);
  m = text.match(/TOTAL\\s*IVA:?\\s*([\\d.,]+)/i);
  if (m) t.vat_amount = esNum(m[1]);
  m = text.match(/(?:^|\\n)[^\\n]*TOTAL:?\\s*([\\d.,]+)/i);
  if (m) t.total = esNum(m[1]);
  if (t.total == null && t.base != null && t.vat_amount != null) t.total = Math.round((t.base + t.vat_amount) * 100) / 100;
  t.amount = t.total;
  m = text.match(/FORMA DE PAGO:?\\s*([^\\n]+)/i);
  if (m) t.payment_method = m[1].replace(/\\s+/g, " ").trim();
  m = text.match(/Matr\\S*?cula\\s*([A-Z0-9]{4,8})/i);
  if (m) t.plate = m[1];
  m = text.match(/Conductor\\s+(?!Densidad)([A-Z][A-Z .]{3,40})/i);
  if (m) t.driver = m[1].trim().replace(/\\s+/g, " ");
  m = text.match(/Densidad\\s*15\\S?\\s*C:?\\s*([\\d.,]+)/i);
  if (m) t.density = esNum(m[1]);
  m = text.match(/([A-Z][A-Z ]{5,40})\\s*\\n\\s*Titular/);
  if (m) t.customer_name = m[1].trim().replace(/\\s+/g, " ");
  m = text.match(/(\\d{8}[A-Z])\\b/);
  if (m) t.customer_tax_id = m[1];
  var lines = [];
  if (t.product || t.total != null) {
    lines.push({ line_no: 1, product_name: t.product || "GASOLEO C", quantity: t.quantity, unit: t.unit, unit_price: t.unit_price, amount: t.amount });
  }
  return { header: t, lines: lines };
}
var base = "https://insforge.benicolo.com";
var bucket = "suppliers";
var all = $input.all();
var groups = {};
for (var idx = 0; idx < all.length; idx++) {
  var item = all[idx];
  var j = item.json || {};
  var text = j.text || j.data || j.content || "";
  if (!text) continue;
  var r = parseAlbero(text);
  var id = j.messageId || j.id || null;
  if (!groups[id]) groups[id] = { invoices: [], others: [] };
  if (r.header.invoice_number) groups[id].invoices.push({ it: item, r: r });
  else groups[id].others.push({ it: item, r: r });
}
var out = [];
for (var gid in groups) {
  var g = groups[gid];
  if (!g.invoices.length) continue;
  var iv = g.invoices[0];
  var h = iv.r.header;
  delete h.raw_text;
  h.message_id = gid;
  h.document_type = h.document_type || "nota_entrega_factura";
  h.pdf_key = iv.it.json.key || null;
  h.pdf_url = h.pdf_key ? (base + "/api/storage/buckets/" + bucket + "/objects/" + encodeURIComponent(h.pdf_key)) : null;
  var resp = g.others[0] || null;
  if (resp) {
    h.responsibility_pdf_key = resp.it.json.key || null;
    h.responsibility_pdf_url = h.responsibility_pdf_key ? (base + "/api/storage/buckets/" + bucket + "/objects/" + encodeURIComponent(h.responsibility_pdf_key)) : null;
    h.responsibility_filename = resp.it.json.filename || null;
  }
  var binary = { data: iv.it.binary ? iv.it.binary.data : undefined };
  if (resp && resp.it.binary && resp.it.binary.data) binary.responsibility = resp.it.binary.data;
  out.push({ json: { message_id: gid, invoice_number: h.invoice_number, key: h.pdf_key, responsibility_key: h.responsibility_pdf_key || null, payload: { p_invoice: h, p_lines: iv.r.lines } }, binary: binary });
}
return out;`;

const supB_startTrigger = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Start', position: [200, 7600] },
  output: [{}]
});

const supB_listMessageIds = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'supB – List Existing Message Ids',
    parameters: {
      method: 'POST',
      url: supB_INS_FORGE_BASE + '/api/database/rpc/supplier_invoice_message_ids',
      sendHeaders: true,
      headerParameters: INS_FORGE_HEADERS,
      options: {}
    },
    position: [420, 7600]
  },
  output: [{ ids: ['18f0000000000000'] }]
});

const supB_listObjects = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'supB – List Existing Objects',
    parameters: {
      method: 'GET',
      url: supB_INS_FORGE_BASE + '/api/storage/buckets/' + supB_BUCKET + '/objects?limit=1000',
      sendHeaders: true,
      headerParameters: INS_FORGE_HEADERS,
      options: {}
    },
    position: [640, 7600]
  },
  output: [{ data: [{ key: 'suppliers/example/factura.pdf' }] }]
});

const supB_getInvoices = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'supB – Get Invoices',
    parameters: {
      resource: 'message',
      operation: 'getAll',
      returnAll: true,
      simple: false,
      filters: { q: 'from:maque@alberosl.com has:attachment filename:pdf', readStatus: 'both' },
      options: { downloadAttachments: true, dataPropertyAttachmentsPrefixName: 'attachment_' }
    },
    credentials: { gmailOAuth2: newCredential('Gmail account') },
    position: [860, 7600]
  },
  output: [{ id: '18f0000000000000', subject: 'Factura Transportes Albero' }]
});

const supB_expandPdfs = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'supB – Expand PDFs',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const out = [];
for (const item of $input.all()) {
  const bin = item.binary || {};
  const id = (item.json && item.json.id) ? item.json.id : "unknown";
  for (const prop of Object.keys(bin)) {
    const meta = bin[prop];
    if (prop.indexOf("attachment_") === 0 && meta && meta.mimeType === "application/pdf") {
      const name = meta.fileName ? meta.fileName : (prop + ".pdf");
      const safeName = String(name).replace(/[^A-Za-z0-9._-]+/g, "_");
      out.push({ json: { messageId: id, key: "suppliers/" + id + "/" + safeName, filename: name, mimeType: meta.mimeType, size: meta.fileSize || 0 }, binary: { data: bin[prop] } });
    }
  }
}
return out;`
    },
    position: [1080, 7600]
  },
  output: [{ key: 'suppliers/18f0000000000000/factura.pdf', messageId: '18f0000000000000' }]
});

const supB_extractPdf = node({
  type: 'n8n-nodes-base.extractFromFile',
  version: 1.1,
  config: {
    name: 'supB – Extract PDF Text',
    parameters: { operation: 'pdf', binaryPropertyName: 'data', options: { keepSource: 'both' } },
    onError: 'continueRegularOutput',
    position: [1300, 7600]
  },
  output: [{ text: 'TRANSPORTES ALBERO S.L. ...' }]
});

const supB_parseInvoice = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'supB – Parse Albero',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: supB_parseCode },
    position: [1520, 7600]
  },
  output: [{ invoice_number: '25760098', key: 'suppliers/18f0000000000000/factura.pdf' }]
});

const supB_notInDb = node({
  type: 'n8n-nodes-base.filter',
  version: 2.2,
  config: {
    name: 'supB – Not In DB',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [
          {
            leftValue: "={{ !($('supB – List Existing Message Ids').first().json.ids || []).includes($json.message_id) }}",
            rightValue: true,
            operator: { type: 'boolean', operation: 'true', singleValue: true }
          }
        ],
        combinator: 'and'
      },
      options: {}
    },
    position: [1740, 7600]
  },
  output: [{ message_id: '18f0000000000000' }]
});

const supB_dbUpsert = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'supB – DB Upsert Invoice',
    parameters: {
      method: 'POST',
      url: supB_INS_FORGE_BASE + '/api/database/rpc/supplier_invoice_upsert',
      sendHeaders: true,
      headerParameters: INS_FORGE_HEADERS,
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json.payload) }}',
      options: {}
    },
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    onError: 'continueRegularOutput',
    position: [1960, 7600]
  },
  output: [{ id: '00000000-0000-0000-0000-000000000000', invoice_number: '25760098' }]
});

const supB_splitFiles = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'supB – Split Files',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `var src = $('supB – Parse Albero').all();
var byNum = {};
for (var i = 0; i < src.length; i++) { var s = src[i].json || {}; if (s.invoice_number) byNum[s.invoice_number] = src[i]; }
var resp = $input.all();
var out = [];
for (var r = 0; r < resp.length; r++) {
  var j = resp[r].json || {};
  var s = byNum[j.invoice_number];
  if (!s) continue;
  var sb = s.binary || {};
  out.push({ json: { invoice_number: j.invoice_number, invoice_id: j.id || null, key: s.json.key || null, role: 'invoice' }, binary: { data: sb.data } });
  if (s.json.responsibility_key && sb.responsibility) {
    out.push({ json: { invoice_number: j.invoice_number, invoice_id: j.id || null, key: s.json.responsibility_key, role: 'responsibility' }, binary: { data: sb.responsibility } });
  }
}
return out;`
    },
    position: [2180, 7600]
  },
  output: [{ invoice_number: '25760098', key: 'suppliers/18f0000000000000/factura.pdf', role: 'invoice' }]
});

const supB_notInStorage = node({
  type: 'n8n-nodes-base.filter',
  version: 2.2,
  config: {
    name: 'supB – Not In Storage',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [
          {
            leftValue: "={{ !($('supB – List Existing Objects').first().json.data || []).some(o => o.key === $json.key) }}",
            rightValue: true,
            operator: { type: 'boolean', operation: 'true', singleValue: true }
          }
        ],
        combinator: 'and'
      },
      options: {}
    },
    position: [2400, 7600]
  },
  output: [{ key: 'suppliers/18f0000000000000/factura.pdf' }]
});

const supB_uploadPdf = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'supB – Upload to InsForge',
    parameters: {
      method: 'PUT',
      url: '=' + supB_INS_FORGE_BASE + '/api/storage/buckets/' + supB_BUCKET + '/objects/{{ encodeURIComponent($json.key) }}',
      sendHeaders: true,
      headerParameters: INS_FORGE_HEADERS,
      sendBody: true,
      contentType: 'multipart-form-data',
      bodyParameters: { parameters: [{ parameterType: 'formBinaryData', name: 'file', inputDataFieldName: 'data' }] },
      options: {}
    },
    retryOnFail: true,
    maxTries: 4,
    waitBetweenTries: 3000,
    onError: 'continueRegularOutput',
    position: [2620, 7600]
  },
  output: [{ key: 'suppliers/18f0000000000000/factura.pdf' }]
});

export default workflow('mis-gastos-ingesta', 'Mis Gastos — Ingesta')
  .add(gmailTrigger)
  .to(routeEmail
    .onCase(0, merc_expandPdfs
  .to(merc_extractPdf)
  .to(merc_parseTicket)
  .to(merc_dbUpsert)
  .to(merc_reattach)
  .to(merc_uploadPdf))
    .onCase(1, ibe_expandPdfs
  .to(ibe_extractPdf)
  .to(ibe_parseInvoice)
  .to(ibe_dbUpsert)
  .to(ibe_reattach)
  .to(ibe_uploadPdf))
    .onCase(2, way_extractLink
  .to(way_downloadPdf)
  .to(way_extractPdf)
  .to(way_parseWaylet)
  .to(way_dbUpsert)
  .to(way_reattach)
  .to(way_uploadPdf))
    .onCase(3, sup_expandPdfs
  .to(sup_extractPdf)
  .to(sup_parseInvoice)
  .to(sup_dbUpsert)
  .to(sup_splitFiles)
  .to(sup_uploadPdf))
  )
  .add(bank_webhookTrigger)
  .to(bank_checkToken
    .onTrue(bank_parseTxt.to(bank_uploadTxt.to(bank_dbUpsert.to(bank_respondOk))))
    .onFalse(bank_respondUnauthorized))
  .add(photo_webhookTrigger)
  .to(photo_checkToken
    .onTrue(photo_buildEncode.to(photo_upload.to(photo_aiExtract.to(photo_parseAi.to(photo_dbCreate.to(photo_respondOk))))))
    .onFalse(photo_respondUnauthorized))
  .add(mercB_startTrigger)
  .to(mercB_listMessageIds)
  .to(mercB_listObjects)
  .to(mercB_getTickets)
  .to(mercB_expandPdfs)
  .to(mercB_extractPdf)
  .to(mercB_parseTicket)
  .to(mercB_notInDb)
  .to(mercB_dbUpsert)
  .to(mercB_reattach)
  .to(mercB_notInStorage)
  .to(mercB_uploadPdf)
  .add(ibeB_startTrigger)
  .to(ibeB_listMessageIds)
  .to(ibeB_listObjects)
  .to(ibeB_getInvoices)
  .to(ibeB_expandPdfs)
  .to(ibeB_extractPdf)
  .to(ibeB_parseInvoice)
  .to(ibeB_notInDb)
  .to(ibeB_dbUpsert)
  .to(ibeB_reattach)
  .to(ibeB_notInStorage)
  .to(ibeB_uploadPdf)
  .add(wayB_startTrigger)
  .to(wayB_listMessageIds)
  .to(wayB_listObjects)
  .to(wayB_getTickets)
  .to(wayB_extractLink)
  .to(wayB_downloadPdf)
  .to(wayB_extractPdf)
  .to(wayB_parseWaylet)
  .to(wayB_notInDb)
  .to(wayB_dbUpsert)
  .to(wayB_reattach)
  .to(wayB_notInStorage)
  .to(wayB_uploadPdf)
  .add(supB_startTrigger)
  .to(supB_listMessageIds)
  .to(supB_listObjects)
  .to(supB_getInvoices)
  .to(supB_expandPdfs)
  .to(supB_extractPdf)
  .to(supB_parseInvoice)
  .to(supB_notInDb)
  .to(supB_dbUpsert)
  .to(supB_splitFiles)
  .to(supB_notInStorage)
  .to(supB_uploadPdf);
