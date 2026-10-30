/**
 * Genera n8n/ingesta.js: un único workflow con todas las ingestas.
 *
 * - 1 Gmail Trigger + Switch por remitente (Mercadona, Iberdrola, Waylet, Proveedores).
 * - 2 Webhooks (bank-statements, ticket-photo).
 * - 4 Manual Triggers (backfills).
 *
 * Reutiliza las ramas de los workflows existentes renombrando constantes y nombres
 * de nodo con un prefijo por dominio para evitar colisiones.
 *
 * Uso: node scripts/n8n-ingesta-build.js
 * Despliegue: node scripts/n8n-build.js n8n/ingesta.js validate|create|update|publish
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const N8N = path.join(ROOT, 'n8n');

// Reutiliza la key admin de InsForge que ya vive en bank-statements.js para inlinear
// la autenticación de los nodos HTTP (el MCP no auto-asigna credenciales en HTTP nodes).
const INS_FORGE_KEY = (fs.readFileSync(path.join(N8N, 'ticket-photo.js'), 'utf8').match(/const INS_FORGE_API_KEY = '([^']+)'/) || [])[1];
if (!INS_FORGE_KEY) throw new Error('No se encontró INS_FORGE_API_KEY en ticket-photo.js');

const SOURCES = [
  {
    file: 'mercadona-tickets-new.js',
    prefix: 'merc',
    kind: 'gmail',
    case: 0,
    offset: 0,
    consts: ['INS_FORGE_BASE', 'BUCKET', 'gmailTrigger', 'expandPdfs', 'extractPdf', 'parseTicket', 'dbUpsert', 'reattach', 'uploadPdf'],
  },
  {
    file: 'iberdrola-invoices.js',
    prefix: 'ibe',
    kind: 'gmail',
    case: 1,
    offset: 800,
    consts: ['INS_FORGE_BASE', 'BUCKET', 'gmailTrigger', 'expandPdfs', 'extractPdf', 'parseInvoice', 'dbUpsert', 'reattach', 'uploadPdf'],
  },
  {
    file: 'waylet-tickets.js',
    prefix: 'way',
    kind: 'gmail',
    case: 2,
    offset: 1600,
    consts: ['INS_FORGE_BASE', 'BUCKET', 'gmailTrigger', 'extractLink', 'downloadPdf', 'extractPdf', 'parseWaylet', 'dbUpsert', 'reattach', 'uploadPdf'],
  },
  {
    file: 'supplier-invoices.js',
    prefix: 'sup',
    kind: 'gmail',
    case: 3,
    offset: 2400,
    consts: ['INS_FORGE_BASE', 'BUCKET', 'parseCode', 'gmailTrigger', 'expandPdfs', 'extractPdf', 'parseInvoice', 'dbUpsert', 'splitFiles', 'uploadPdf'],
  },
  {
    file: 'bank-statements.js',
    prefix: 'bank',
    kind: 'own',
    offset: 3200,
    consts: ['INS_FORGE_BASE', 'BUCKET', 'WEBHOOK_PATH', 'WEBHOOK_TOKEN', 'webhookTrigger', 'checkToken', 'parseTxt', 'uploadTxt', 'dbUpsert', 'respondOk', 'respondUnauthorized'],
  },
  {
    file: 'ticket-photo.js',
    prefix: 'photo',
    kind: 'own',
    offset: 4000,
    consts: ['INS_FORGE_BASE', 'BUCKET', 'WEBHOOK_PATH', 'WEBHOOK_TOKEN', 'INS_FORGE_API_KEY', 'INS_FORGE_HEADERS', 'OPENROUTER_URL', 'OPENROUTER_MODEL', 'OPENROUTER_API_KEY', 'OPENROUTER_HEADERS', 'webhookTrigger', 'checkToken', 'buildEncode', 'upload', 'aiExtract', 'parseAi', 'dbCreate', 'respondOk', 'respondUnauthorized'],
  },
  {
    file: 'mercadona-tickets.js',
    prefix: 'mercB',
    kind: 'own',
    offset: 4800,
    consts: ['INS_FORGE_BASE', 'BUCKET', 'startTrigger', 'listMessageIds', 'listObjects', 'getTickets', 'expandPdfs', 'extractPdf', 'parseTicket', 'notInDb', 'dbUpsert', 'reattach', 'notInStorage', 'uploadPdf'],
  },
  {
    file: 'iberdrola-backfill.js',
    prefix: 'ibeB',
    kind: 'own',
    offset: 5600,
    consts: ['INS_FORGE_BASE', 'BUCKET', 'startTrigger', 'listMessageIds', 'listObjects', 'getInvoices', 'expandPdfs', 'extractPdf', 'parseInvoice', 'notInDb', 'dbUpsert', 'reattach', 'notInStorage', 'uploadPdf'],
  },
  {
    file: 'waylet-backfill.js',
    prefix: 'wayB',
    kind: 'own',
    offset: 6400,
    consts: ['INS_FORGE_BASE', 'BUCKET', 'startTrigger', 'listMessageIds', 'listObjects', 'getTickets', 'extractLink', 'downloadPdf', 'extractPdf', 'parseWaylet', 'notInDb', 'dbUpsert', 'reattach', 'notInStorage', 'uploadPdf'],
  },
  {
    file: 'supplier-backfill.js',
    prefix: 'supB',
    kind: 'own',
    offset: 7200,
    consts: ['INS_FORGE_BASE', 'BUCKET', 'parseCode', 'startTrigger', 'listMessageIds', 'listObjects', 'getInvoices', 'expandPdfs', 'extractPdf', 'parseInvoice', 'notInDb', 'dbUpsert', 'splitFiles', 'notInStorage', 'uploadPdf'],
  },
];

function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function transform(source, offset) {
  const file = path.join(N8N, source.file);
  let src = fs.readFileSync(file, 'utf8');

  src = src.replace(/^import[^\n]*\n/m, '');

  const marker = 'export default workflow(';
  const idx = src.indexOf(marker);
  if (idx < 0) throw new Error(`${source.file}: no se encontró "export default workflow("`);

  let body = src.slice(0, idx);
  let chain = src.slice(idx);

  // Prefijar identificadores de nivel superior (declaración + referencias)
  for (const id of source.consts) {
    const re = new RegExp('\\b' + escRe(id) + '\\b', 'g');
    body = body.replace(re, `${source.prefix}_${id}`);
    chain = chain.replace(re, `${source.prefix}_${id}`);
  }

  // Prefijar nombres de nodo (solo los de 4 espacios: config.name) y sus $('...')
  const names = Array.from(body.matchAll(/^    name: '([^']+)'/gm)).map((m) => m[1]);
  for (const oldName of names) {
    const newName = `${source.prefix} – ${oldName}`;
    body = body.split(`    name: '${oldName}'`).join(`    name: '${newName}'`);
    body = body.split(`$('${oldName}')`).join(`$('${newName}')`);
  }

  // Separar verticalmente las ramas
  body = body.replace(/position: \[(\d+), (\d+)\]/g, (_, x, y) => `position: [${x}, ${Number(y) + offset}]`);

  // Inlinear la credencial de InsForge dentro de `parameters` (evita asignación manual)
  body = body.replace(
    /authentication: 'genericCredentialType',\s*\n\s*genericAuthType: 'httpHeaderAuth',/g,
    'sendHeaders: true,\n      headerParameters: INS_FORGE_HEADERS,',
  );
  body = body.replace(/\n\s*credentials: \{ httpHeaderAuth: newCredential\('InsForge'\) \},/g, '');

  // Extraer solo la composición (.add(...)...) del export original
  const addIdx = chain.indexOf('.add(');
  if (addIdx < 0) throw new Error(`${source.file}: no se encontró ".add(" en el export`);
  let addPart = chain.slice(addIdx).trim();

  let branch;
  if (source.kind === 'gmail') {
    const rest = addPart.replace(/^\.add\([^)]*\)/, '').trim();
    const first = rest.match(/^\.to\(([A-Za-z_$][\w$]*)\)([\s\S]*)$/);
    if (!first) throw new Error(`${source.file}: no se encontró el primer nodo de la rama`);
    branch = first[1] + first[2];
    branch = branch.replace(/;\s*$/, '');
  } else {
    branch = addPart.replace(/;\s*$/, '');
  }

  return { body: body.trim(), branch };
}

function rule(fromValue, extra) {
  const conditions = [
    { leftValue: '={{ $json.from }}', rightValue: fromValue, operator: { type: 'string', operation: 'contains' } },
  ];
  if (extra) conditions.push(extra);
  return {
    conditions: {
      options: { caseSensitive: false, leftValue: '', typeValidation: 'loose', version: 2 },
      conditions,
      combinator: 'and',
    },
    renameOutput: true,
    outputKey: fromValue,
  };
}

const GMAIL_QUERY = [
  '(from:ticket_digital@mail.mercadona.com has:attachment filename:pdf)',
  '(from:clientes@clientesiberdrola.es has:attachment filename:pdf)',
  '(from:benicolo@gmail.com subject:Waylet)',
  '(from:maque@alberosl.com has:attachment filename:pdf)',
].join(' OR ');

const HEADER = `import { workflow, node, trigger, newCredential, ifElse, switchCase } from '@n8n/workflow-sdk';

// ============================================================================
// WORKFLOW ÚNICO DE INGESTA — generado por scripts/n8n-ingesta-build.js
// No editar a mano: modifica los workflows fuente o este generador y regenera.
// ============================================================================

const INS_FORGE_HEADERS = { parameters: [{ name: 'Authorization', value: 'Bearer ${INS_FORGE_KEY}' }] };

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
        q: '${GMAIL_QUERY.replace(/'/g, "\\'")}',
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
          ${JSON.stringify(rule('ticket_digital@mail.mercadona.com'))},
          ${JSON.stringify(rule('clientesiberdrola.es'))},
          ${JSON.stringify(rule('benicolo@gmail.com', { leftValue: '={{ $json.subject }}', rightValue: 'Waylet', operator: { type: 'string', operation: 'contains' } }))},
          ${JSON.stringify(rule('alberosl.com'))}
        ]
      },
      options: { fallbackOutput: 'none' }
    },
    position: [460, 100]
  },
  output: [{ from: 'Mercadona <ticket_digital@mail.mercadona.com>', subject: 'Tu ticket Mercadona' }]
});

`;

const parts = SOURCES.map((s) => ({ source: s, ...transform(s, s.offset) }));

const gmailBranches = parts.filter((p) => p.source.kind === 'gmail');
const ownBranches = parts.filter((p) => p.source.kind === 'own');

const composition = [];
composition.push(`export default workflow('mis-gastos-ingesta', 'Mis Gastos — Ingesta')`);
composition.push(`  .add(gmailTrigger)`);
composition.push(`  .to(routeEmail`);
for (const p of gmailBranches) {
  composition.push(`    .onCase(${p.source.case}, ${p.branch})`);
}
composition.push(`  )`);
for (const p of ownBranches) {
  composition.push(`  ${p.branch}`);
}
composition[composition.length - 1] += ';';

const out = HEADER + parts.map((p) => p.body).join('\n\n') + '\n\n' + composition.join('\n') + '\n';

fs.writeFileSync(path.join(N8N, 'ingesta.js'), out);
console.log('wrote n8n/ingesta.js');
