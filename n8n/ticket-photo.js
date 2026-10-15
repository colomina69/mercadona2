import { workflow, node, trigger, ifElse, newCredential } from '@n8n/workflow-sdk';

const INS_FORGE_BASE = 'https://insforge.benicolo.com';
const BUCKET = 'receipts';
const WEBHOOK_PATH = 'ticket-photo';
const WEBHOOK_TOKEN = 'ph_ti_e64322429728a0379074277ea28e552376f41554f1b64726';
const INS_FORGE_API_KEY = 'ik_06af335eeadbdfe2f6c12fa82c1d152c512a516af32ba808a37bfbfdb6ee0900';
const INS_FORGE_HEADERS = { parameters: [{ name: 'Authorization', value: 'Bearer ' + INS_FORGE_API_KEY }] };

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODEL = 'deepseek/deepseek-v4.1-flash';

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

const buildEncode = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build & Encode',
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
  model: '${OPENROUTER_MODEL}',
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
    position: [680, 300]
  },
  output: [{ key: 'receipts/1700000000000_abc.jpg', captured_at: '2026-10-08T10:00:00Z', aiBody: '{"model":"deepseek/deepseek-v4.1-flash"}' }]
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

const aiExtract = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'AI Extract',
    parameters: {
      method: 'POST',
      url: OPENROUTER_URL,
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'HTTP-Referer', value: INS_FORGE_BASE },
          { name: 'X-Title', value: 'Mis Gastos - Ticket Photo' }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: "={{ $('Build & Encode').first().json.aiBody }}",
      options: { timeout: 60000 }
    },
    credentials: { httpHeaderAuth: newCredential('OpenRouter') },
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 3000,
    position: [1160, 300]
  },
  output: [{ choices: [{ message: { content: '{"store_name":"MERCADONA","total":12.5,"lines":[]}' } }] }]
});

const parseAi = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse AI',
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
const build = $('Build & Encode').first().json;
const up = $('Upload Image').first().json || {};
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
    position: [1400, 300]
  },
  output: [{ ticket: { store_name: 'MERCADONA', total: 12.5 }, lines: [{ line_no: 1, product_name: 'Leche', amount: 1.05 }] }]
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
      jsonBody: "={{ JSON.stringify({ p_ticket: $json.ticket, p_lines: $json.lines }) }}",
      options: {}
    },
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    position: [1640, 300]
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
    position: [1880, 260]
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
    .onTrue(buildEncode.to(upload.to(aiExtract.to(parseAi.to(dbCreate.to(respondOk))))))
    .onFalse(respondUnauthorized));
