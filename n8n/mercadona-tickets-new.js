import { workflow, node, trigger, newCredential } from '@n8n/workflow-sdk';

const INS_FORGE_BASE = 'https://insforge.benicolo.com';
const BUCKET = 'mercadona';

const gmailTrigger = trigger({
  type: 'n8n-nodes-base.gmailTrigger',
  version: 1.3,
  config: {
    name: 'New Mercadona Ticket',
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

const expandPdfs = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Expand PDFs',
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

const extractPdf = node({
  type: 'n8n-nodes-base.extractFromFile',
  version: 1.1,
  config: {
    name: 'Extract PDF Text',
    parameters: {
      operation: 'pdf',
      binaryPropertyName: 'data',
      options: { keepSource: 'both' }
    },
    position: [700, 300]
  },
  output: [{ text: 'MERCADONA, S.A. ...' }]
});

const parseTicket = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse Ticket',
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

function parseTicket(raw) {
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
  var t = parseTicket(text);
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

const dbUpsert = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'DB Upsert Ticket',
    parameters: {
      method: 'POST',
      url: INS_FORGE_BASE + '/api/database/rpc/mercadona_upsert_ticket',
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
    position: [1180, 300]
  },
  output: [{ id: '00000000-0000-0000-0000-000000000000', message_id: '18f0000000000000' }]
});

const reattach = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Reattach PDF',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `var parsed = $('Parse Ticket').all();
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
      bodyParameters: {
        parameters: [
          { parameterType: 'formBinaryData', name: 'file', inputDataFieldName: 'data' }
        ]
      },
      options: {}
    },
    credentials: { httpHeaderAuth: newCredential('InsForge') },
    retryOnFail: true,
    maxTries: 4,
    waitBetweenTries: 3000,
    onError: 'continueRegularOutput',
    position: [1660, 300]
  },
  output: [{ key: 'mercadona/18f0000000000000/ticket.pdf' }]
});

export default workflow('mercadona-tickets-to-insforge-new', 'Mercadona Tickets to InsForge (New)')
  .add(gmailTrigger)
  .to(expandPdfs)
  .to(extractPdf)
  .to(parseTicket)
  .to(dbUpsert)
  .to(reattach)
  .to(uploadPdf);
