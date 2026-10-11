import { workflow, node, trigger, ifElse } from '@n8n/workflow-sdk';

const INS_FORGE_BASE = 'https://insforge.benicolo.com';
const BUCKET = 'receipts';
const WEBHOOK_PATH = 'ticket-photo';
const WEBHOOK_TOKEN = 'ph_ti_e64322429728a0379074277ea28e552376f41554f1b64726';
const INS_FORGE_API_KEY = 'ik_06af335eeadbdfe2f6c12fa82c1d152c512a516af32ba808a37bfbfdb6ee0900';
const INS_FORGE_HEADERS = { parameters: [{ name: 'Authorization', value: 'Bearer ' + INS_FORGE_API_KEY }] };

const webhookTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Ticket Photo Webhook',
    parameters: {
      httpMethod: 'POST',
      path: WEBHOOK_PATH,
      responseMode: 'responseNode',
      options: {
        binaryData: true,
        binaryPropertyName: 'data'
      }
    },
    position: [200, 300]
  },
  output: [{ headers: { 'x-webhook-token': WEBHOOK_TOKEN }, body: { raw_text: 'TOTAL 12,50', captured_at: '2026-10-08T10:00:00Z' } }]
});

const checkToken = ifElse({
  version: 2.3,
  config: {
    name: 'Check Token',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        combinator: 'and',
        conditions: [
          {
            leftValue: "={{ $json.headers['x-webhook-token'] || $json.headers['X-Webhook-Token'] }}",
            rightValue: WEBHOOK_TOKEN,
            operator: { type: 'string', operation: 'equals' }
          }
        ]
      }
    },
    position: [440, 300]
  }
});

const build = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const item = $input.first();
const b = (item.binary && item.binary.data) || {};
const body = (item.json && item.json.body) || {};
const ext = b.fileExtension || 'jpg';
const key = 'receipts/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;
return [{ json: { key: key, captured_at: body.captured_at || null, raw_text: body.raw_text || '', mimeType: b.mimeType || 'image/jpeg', filename: b.fileName || null }, binary: { data: b } }];`
    },
    position: [680, 300]
  },
  output: [{ key: 'receipts/1700000000000_abc123.jpg' }]
});

const upload = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Upload Image',
    parameters: {
      method: 'PUT',
      url: '=' + INS_FORGE_BASE + '/api/storage/buckets/' + BUCKET + '/objects/{{ encodeURIComponent($json.key) }}',
      sendHeaders: true,
      headerParameters: INS_FORGE_HEADERS,
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
    position: [920, 300]
  },
  output: [{ key: 'receipts/1700000000000_abc123.jpg', url: 'https://insforge.benicolo.com/api/storage/buckets/receipts/objects/receipts%2F...jpg' }]
});

const dbCreate = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'DB Create',
    parameters: {
      method: 'POST',
      url: INS_FORGE_BASE + '/api/database/rpc/photo_ticket_create',
      sendHeaders: true,
      headerParameters: INS_FORGE_HEADERS,
      sendBody: true,
      specifyBody: 'json',
      jsonBody: "={{ JSON.stringify({ p_ticket: { status: 'pendiente', captured_at: $('Build').first().json.captured_at, raw_text: $('Build').first().json.raw_text, image_key: $json.key, image_url: $json.url } }) }}",
      options: {}
    },
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    position: [1160, 300]
  },
  output: [{ id: '00000000-0000-0000-0000-000000000000' }]
});

const respondOk = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond OK',
    parameters: {
      respondWith: 'json',
      responseBody: "={{ { ok: true, id: $json.id } }}"
    },
    position: [1400, 260]
  },
  output: [{ ok: true, id: '00000000-0000-0000-0000-000000000000' }]
});

const respondUnauthorized = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Unauthorized',
    parameters: {
      respondWith: 'json',
      responseBody: "={{ { ok: false, error: 'unauthorized' } }}",
      options: { responseCode: 401 }
    },
    position: [680, 520]
  },
  output: [{ ok: false, error: 'unauthorized' }]
});

export default workflow('ticket-photo-to-insforge', 'Ticket Photo to InsForge')
  .add(webhookTrigger)
  .to(checkToken
    .onTrue(build.to(upload.to(dbCreate.to(respondOk))))
    .onFalse(respondUnauthorized));
