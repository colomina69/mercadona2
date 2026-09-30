import { workflow, node, trigger, newCredential, ifElse } from '@n8n/workflow-sdk';

const INS_FORGE_BASE = 'https://insforge.benicolo.com';
const BUCKET = 'bank-statements';
const WEBHOOK_PATH = 'bank-statements';
const WEBHOOK_TOKEN = 'bk_edcd4520c3d4aa55f4c49cce38ad574b1315dc1b2e1b7ecc';

const webhookTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Bank TXT Webhook',
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
  output: [{ headers: { 'x-webhook-token': WEBHOOK_TOKEN }, body: {} }]
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

// Reads the uploaded file with this.helpers.getBinaryDataBuffer so it also works
// when the workflow runs in "separate" binary mode, then decodes it as Latin-1.
const parseTxt = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse TXT',
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
    position: [680, 300]
  },
  output: [{ rows: [], count: 0, text_len: 0, source_file: 'movimientos.txt', raw_key: 'statements/x-movimientos.txt' }]
});

const uploadTxt = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Upload TXT',
    parameters: {
      method: 'PUT',
      url: '=' + INS_FORGE_BASE + '/api/storage/buckets/' + BUCKET + '/objects/{{ encodeURIComponent($json.raw_key) }}',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      contentType: 'multipart-form-data',
      bodyParameters: {
        parameters: [
          { parameterType: 'formBinaryData', name: 'file', inputDataFieldName: 'file' }
        ]
      },
      options: {}
    },
    credentials: { httpHeaderAuth: newCredential('InsForge') },
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    onError: 'continueRegularOutput',
    position: [920, 300]
  },
  output: [{ key: 'statements/x-movimientos.txt' }]
});

const dbUpsert = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'DB Upsert',
    parameters: {
      method: 'POST',
      url: INS_FORGE_BASE + '/api/database/rpc/bank_upsert_transactions',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: "={{ JSON.stringify({ p_rows: $('Parse TXT').first().json.rows, p_source_file: $('Parse TXT').first().json.source_file, p_raw_key: $('Parse TXT').first().json.raw_key }) }}",
      options: {}
    },
    credentials: { httpHeaderAuth: newCredential('InsForge') },
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    position: [1160, 300]
  },
  output: [{ inserted: 0, skipped: 0, total: 0 }]
});

const respondOk = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond OK',
    parameters: {
      respondWith: 'json',
      responseBody: "={{ { ok: true, inserted: $json.inserted, skipped: $json.skipped, total: $json.total, parsed: $('Parse TXT').first().json.count, text_len: $('Parse TXT').first().json.text_len, source_file: $('Parse TXT').first().json.source_file, raw_key: $('Parse TXT').first().json.raw_key } }}"
    },
    position: [1400, 260]
  },
  output: [{ ok: true, inserted: 0, skipped: 0, total: 0 }]
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

export default workflow('bank-statements-to-insforge', 'Bank Statements to InsForge')
  .add(webhookTrigger)
  .to(checkToken
    .onTrue(parseTxt.to(uploadTxt.to(dbUpsert.to(respondOk))))
    .onFalse(respondUnauthorized));
