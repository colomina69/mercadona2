const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const parserSrc = fs
  .readFileSync(path.join(root, 'n8n', 'waylet-parser.js'), 'utf8')
  .replace(/module\.exports[\s\S]*$/, '');

const driver = `
var base = "https://insforge.benicolo.com"; var bucket = "waylet";
var meta = $('Extract link').all();
var items = $input.all(); var out = [];
for (var i = 0; i < items.length; i++) {
  var item = items[i]; var j = item.json || {};
  var text = j.text || j.data || "";
  var r = parseWaylet(text); var h = r.header;
  if (!h.ticket_number) continue;
  var mi = meta[i] ? (meta[i].json || {}) : {};
  var messageId = mi.messageId || j.id || null;
  var locality = h.locality || mi.locality || null;
  var key = "waylet/" + (h.ticket_number || messageId || "ticket") + ".pdf";
  var payload = {
    p_ticket: {
      message_id: messageId,
      waylet_id: h.waylet_id || null,
      ticket_number: h.ticket_number,
      purchased_at: h.purchased_at || null,
      station_name: h.station_name || null,
      address: h.address || null,
      postal_code: h.postal_code || null,
      locality: locality,
      fuel_type: h.fuel_type || null,
      liters: h.liters,
      unit_price: h.unit_price,
      gross_amount: h.gross_amount,
      discount_amount: h.discount_amount,
      total: h.total,
      payment_method: h.payment_method || null,
      card_last4: h.card_last4 || null,
      vehicle_plate: h.vehicle_plate || null,
      points: h.points,
      pdf_key: key,
      pdf_url: base + "/api/storage/buckets/" + bucket + "/objects/" + encodeURIComponent(key),
      raw_text: h.raw_text
    },
    p_lines: r.lines
  };
  out.push({ json: { message_id: messageId, key: key, ticket_number: h.ticket_number, locality: locality, payload: payload }, binary: item.binary });
}
return out;
`;

const parseCode = parserSrc + driver;

const extractLinkCode = `var out = [];
var items = $input.all();
for (var i = 0; i < items.length; i++) {
  var j = items[i].json || {};
  var body = String(j.html || j.text || j.body || "");
  var m = body.match(/https:\\/\\/waylet\\.repsol\\.everiscloudpayments\\.com\\/waylet\\/api\\/public\\/klikin\\/ticket-services\\/v1\\/ticket\\/[A-Za-z0-9]+/);
  if (!m) continue;
  var subject = j.subject || (j.headers && j.headers.subject) || "";
  var lm = String(subject).match(/Waylet\\s*-\\s*ES GLEM S\\.?L\\.?\\s+(.+)$/i);
  out.push({ json: { messageId: j.id || null, subject: subject, locality: lm ? lm[1].trim() : null, url: m[0] } });
}
return out;`;

const reattachCode = `var parsed = $('Parse Waylet').all();
var byTicket = {};
for (var i = 0; i < parsed.length; i++) { var pj = parsed[i].json || {}; if (pj.ticket_number) byTicket[pj.ticket_number] = parsed[i]; }
var resp = $input.all(); var out = [];
for (var r = 0; r < resp.length; r++) {
  var j = resp[r].json || {};
  var src = byTicket[j.ticket_number];
  out.push({ json: { ticket_id: j.id || null, key: src ? (src.json.key || null) : null }, binary: src ? src.binary : undefined });
}
return out;`;

const gmailParams = `{
      pollTimes: { item: [{ mode: 'everyMinute' }] },
      event: 'messageReceived',
      simple: false,
      filters: {
        q: 'from:benicolo@gmail.com subject:Waylet',
        readStatus: 'both'
      },
      options: {}
    }`;

const file = `import { workflow, node, trigger, newCredential } from '@n8n/workflow-sdk';

const INS_FORGE_BASE = 'https://insforge.benicolo.com';
const BUCKET = 'waylet';

const gmailTrigger = trigger({
  type: 'n8n-nodes-base.gmailTrigger',
  version: 1.3,
  config: {
    name: 'New Waylet Ticket',
    parameters: ${gmailParams},
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
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${JSON.stringify(extractLinkCode)} },
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
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${JSON.stringify(parseCode)} },
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
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${JSON.stringify(reattachCode)} },
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
`;

fs.writeFileSync(path.join(root, 'n8n', 'waylet-tickets.js'), file);
console.log('wrote n8n/waylet-tickets.js');

const backfill = `import { workflow, node, trigger, newCredential } from '@n8n/workflow-sdk';

const INS_FORGE_BASE = 'https://insforge.benicolo.com';
const BUCKET = 'waylet';

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
      url: INS_FORGE_BASE + '/api/database/rpc/waylet_ticket_message_ids',
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
  output: [{ data: [{ key: 'waylet/example.pdf' }] }]
});

const getTickets = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Get Tickets',
    parameters: {
      resource: 'message',
      operation: 'getAll',
      returnAll: true,
      simple: false,
      filters: { q: 'from:benicolo@gmail.com subject:Waylet', readStatus: 'both' },
      options: {}
    },
    credentials: { gmailOAuth2: newCredential('Gmail account') },
    position: [860, 400]
  },
  output: [{ id: '18f0000000000000', subject: 'Waylet - ES GLEM S.L COCENTAINA' }]
});

const extractLink = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Extract link',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${JSON.stringify(extractLinkCode)} },
    position: [1080, 400]
  },
  output: [{ messageId: '18f0000000000000', locality: 'COCENTAINA', url: 'https://...' }]
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
    position: [1300, 400]
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
    position: [1520, 400]
  },
  output: [{ text: 'ES GLEM SL ...' }]
});

const parseWaylet = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse Waylet',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${JSON.stringify(parseCode)} },
    position: [1740, 400]
  },
  output: [{ ticket_number: '262400250757', key: 'waylet/262400250757.pdf' }]
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
    position: [1960, 400]
  },
  output: [{ message_id: '18f0000000000000' }]
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
    position: [2180, 400]
  },
  output: [{ id: '00000000-0000-0000-0000-000000000000', ticket_number: '262400250757' }]
});

const reattach = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Reattach PDF',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${JSON.stringify(reattachCode)} },
    position: [2400, 400]
  },
  output: [{ ticket_id: '00000000-0000-0000-0000-000000000000', key: 'waylet/262400250757.pdf' }]
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
    position: [2620, 400]
  },
  output: [{ key: 'waylet/262400250757.pdf' }]
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
    position: [2840, 400]
  },
  output: [{ key: 'waylet/262400250757.pdf' }]
});

export default workflow('waylet-tickets-backfill', 'Waylet Tickets Backfill')
  .add(startTrigger)
  .to(listMessageIds)
  .to(listObjects)
  .to(getTickets)
  .to(extractLink)
  .to(downloadPdf)
  .to(extractPdf)
  .to(parseWaylet)
  .to(notInDb)
  .to(dbUpsert)
  .to(reattach)
  .to(notInStorage)
  .to(uploadPdf);
`;

fs.writeFileSync(path.join(root, 'n8n', 'waylet-backfill.js'), backfill);
console.log('wrote n8n/waylet-backfill.js');
