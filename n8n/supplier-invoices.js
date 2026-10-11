import { workflow, node, trigger, newCredential } from '@n8n/workflow-sdk';

const INS_FORGE_BASE = 'https://insforge.benicolo.com';
const BUCKET = 'suppliers';

const parseCode = `function norm(s) {
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

const gmailTrigger = trigger({
  type: 'n8n-nodes-base.gmailTrigger',
  version: 1.3,
  config: {
    name: 'New Supplier Invoice (Albero)',
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
    position: [220, 300]
  },
  output: [{ id: '18f0000000000000', subject: 'Factura Transportes Albero' }]
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
        json: { messageId: id, key: "suppliers/" + id + "/" + safeName, filename: name, mimeType: meta.mimeType, size: meta.fileSize || 0 },
        binary: { data: bin[prop] }
      });
    }
  }
}
return out;`
    },
    position: [460, 300]
  },
  output: [{ key: 'suppliers/18f0000000000000/factura.pdf', messageId: '18f0000000000000' }]
});

const extractPdf = node({
  type: 'n8n-nodes-base.extractFromFile',
  version: 1.1,
  config: {
    name: 'Extract PDF Text',
    parameters: { operation: 'pdf', binaryPropertyName: 'data', options: { keepSource: 'both' } },
    onError: 'continueRegularOutput',
    position: [700, 300]
  },
  output: [{ text: 'TRANSPORTES ALBERO S.L. ...' }]
});

const parseInvoice = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse Albero',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: parseCode },
    position: [940, 300]
  },
  output: [{ invoice_number: '25760098', key: 'suppliers/18f0000000000000/factura.pdf' }]
});

const dbUpsert = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'DB Upsert Invoice',
    parameters: {
      method: 'POST',
      url: INS_FORGE_BASE + '/api/database/rpc/supplier_invoice_upsert',
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
    onError: 'continueRegularOutput',
    position: [1180, 300]
  },
  output: [{ id: '00000000-0000-0000-0000-000000000000', invoice_number: '25760098' }]
});

const splitFiles = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Split Files',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `var src = $('Parse Albero').all();
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
    position: [1420, 300]
  },
  output: [{ invoice_number: '25760098', key: 'suppliers/18f0000000000000/factura.pdf', role: 'invoice' }]
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
    position: [1660, 300]
  },
  output: [{ key: 'suppliers/18f0000000000000/factura.pdf' }]
});

export default workflow('supplier-invoices-to-insforge', 'Supplier Invoices to InsForge')
  .add(gmailTrigger)
  .to(expandPdfs)
  .to(extractPdf)
  .to(parseInvoice)
  .to(dbUpsert)
  .to(splitFiles)
  .to(uploadPdf);
