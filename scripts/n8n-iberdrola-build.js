const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const parserSrc = fs
  .readFileSync(path.join(root, 'n8n', 'iberdrola-parser.js'), 'utf8')
  .replace(/module\.exports[\s\S]*$/, '');

const driver = `
var base = "https://insforge.benicolo.com"; var bucket = "iberdrola";
var out = []; var all = $input.all();
for (var idx = 0; idx < all.length; idx++) {
  var item = all[idx]; var j = item.json || {};
  var text = j.text || j.data || j.content || "";
  var r = parseIberdrola(text); var h = r.header;
  if (!h.invoice_number) continue;
  var messageId = j.messageId || j.id || null;
  var key = "iberdrola/" + (h.contract_number || "unknown") + "/" + (h.invoice_number || messageId || "factura") + ".pdf";
  var payload = {
    p_invoice: {
      message_id: messageId,
      contract_number: h.contract_number || null,
      contract_label: h.contract_label || null,
      invoice_number: h.invoice_number || null,
      issue_date: h.issue_date || null,
      period_start: h.period_start || null,
      period_end: h.period_end || null,
      due_date: h.due_date || null,
      tariff: h.tariff || null,
      days_billed: (h.days_billed == null ? null : String(h.days_billed)),
      total: h.total,
      subtotal: h.subtotal,
      energy_amount: h.energy_amount,
      charges_amount: h.charges_amount,
      services_amount: h.services_amount,
      tax_amount: h.tax_amount,
      consumption_kwh: h.consumption_kwh,
      cups: h.cups || null,
      supply_address: h.supply_address || null,
      city: h.city || null,
      titular: h.titular || null,
      nif: h.nif || null,
      contracted_power_punta: h.contracted_power_punta,
      contracted_power_valle: h.contracted_power_valle,
      pdf_key: key,
      pdf_url: base + "/api/storage/buckets/" + bucket + "/objects/" + encodeURIComponent(key),
      raw_text: h.raw_text
    },
    p_lines: r.lines,
    p_consumption: r.consumption
  };
  out.push({ json: { message_id: messageId, key: key, invoice_number: h.invoice_number, contract_number: h.contract_number, total: h.total, lines_count: r.lines.length, payload: payload }, binary: item.binary });
}
return out;
`;

const parseCode = parserSrc + driver;

const expandCode = `const out = [];
for (const item of $input.all()) {
  const bin = item.binary || {};
  const id = (item.json && item.json.id) ? item.json.id : "unknown";
  for (const prop of Object.keys(bin)) {
    const meta = bin[prop];
    if (prop.indexOf("attachment_") === 0 && meta && meta.mimeType === "application/pdf") {
      const name = meta.fileName ? meta.fileName : (prop + ".pdf");
      const safeName = String(name).replace(/[^A-Za-z0-9._-]+/g, "_");
      out.push({
        json: { messageId: id, filename: name, mimeType: meta.mimeType, size: meta.fileSize || 0, safeName: safeName },
        binary: { data: bin[prop] }
      });
    }
  }
}
return out;`;

const reattachCode = `var parsed = $('Parse Iberdrola').all();
var byInv = {};
for (var i = 0; i < parsed.length; i++) { var pj = parsed[i].json || {}; if (pj.invoice_number) byInv[pj.invoice_number] = parsed[i]; }
var resp = $input.all(); var out = [];
for (var r = 0; r < resp.length; r++) {
  var j = resp[r].json || {};
  var src = byInv[j.invoice_number];
  out.push({ json: { invoice_id: j.id || null, key: src ? (src.json.key || null) : null }, binary: src ? src.binary : undefined });
}
return out;`;

const file = `import { workflow, node, trigger, newCredential } from '@n8n/workflow-sdk';

const INS_FORGE_BASE = 'https://insforge.benicolo.com';
const BUCKET = 'iberdrola';

const gmailTrigger = trigger({
  type: 'n8n-nodes-base.gmailTrigger',
  version: 1.3,
  config: {
    name: 'New Iberdrola Invoice',
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
    position: [220, 300]
  },
  output: [{ id: '18f0000000000000', subject: 'Tu factura de luz' }]
});

const expandPdfs = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Expand PDFs',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: ${JSON.stringify(expandCode)}
    },
    position: [460, 300]
  },
  output: [{ messageId: '18f0000000000000', filename: 'factura.pdf', safeName: 'factura.pdf' }]
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
    onError: 'continueRegularOutput',
    position: [700, 300]
  },
  output: [{ text: 'FACTURA DE ELECTRICIDAD ...' }]
});

const parseInvoice = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse Iberdrola',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: ${JSON.stringify(parseCode)}
    },
    position: [940, 300]
  },
  output: [{ message_id: '18f0000000000000', key: 'iberdrola/279914829/21240222010006319.pdf', lines_count: 9 }]
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
    position: [1180, 300]
  },
  output: [{ id: '00000000-0000-0000-0000-000000000000', invoice_number: '21240222010006319' }]
});

const reattach = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Reattach PDF',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: ${JSON.stringify(reattachCode)}
    },
    position: [1420, 300]
  },
  output: [{ invoice_id: '00000000-0000-0000-0000-000000000000', key: 'iberdrola/279914829/21240222010006319.pdf' }]
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
  output: [{ key: 'iberdrola/279914829/21240222010006319.pdf' }]
});

export default workflow('iberdrola-invoices-to-insforge', 'Iberdrola Invoices to InsForge')
  .add(gmailTrigger)
  .to(expandPdfs)
  .to(extractPdf)
  .to(parseInvoice)
  .to(dbUpsert)
  .to(reattach)
  .to(uploadPdf);
`;

fs.writeFileSync(path.join(root, 'n8n', 'iberdrola-invoices.js'), file);
console.log('wrote n8n/iberdrola-invoices.js');

const backfill = `import { workflow, node, trigger, newCredential } from '@n8n/workflow-sdk';

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
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${JSON.stringify(expandCode)} },
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
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${JSON.stringify(parseCode)} },
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
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${JSON.stringify(reattachCode)} },
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
`;

fs.writeFileSync(path.join(root, 'n8n', 'iberdrola-backfill.js'), backfill);
console.log('wrote n8n/iberdrola-backfill.js');
