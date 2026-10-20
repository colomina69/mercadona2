const fs = require('fs');
const path = require('path');
const https = require('https');

const MCP_URL = 'https://n8n.benicolo.com/mcp-server/http';
const TOKEN = process.env.N8N_MCP_TOKEN;

// Carga secretos locales (gitignored) sin dependencias externas.
function loadEnv(file) {
  try {
    const txt = fs.readFileSync(file, 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    }
  } catch (_) {
    // Sin fichero de entorno: se usan las variables ya presentes.
  }
}
loadEnv(path.join(__dirname, '..', 'n8n', '.env.local'));
loadEnv(path.join(__dirname, '..', '.env.local'));

function call(tool, args) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: tool, arguments: args },
    });
    const req = https.request(
      MCP_URL,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + TOKEN,
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => {
          body += c;
        });
        res.on('end', () => {
          const lines = body.split(/\r?\n/).filter((l) => l.indexOf('data: ') === 0);
          const raw = lines.length ? lines.map((l) => l.slice(6)).join('') : body;
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            resolve({ raw: body });
          }
        });
      },
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function text(res) {
  const c = res.result && res.result.content;
  if (c) return c.map((x) => x.text || JSON.stringify(x)).join('\n');
  return JSON.stringify(res, null, 2);
}

(async () => {
  const file = process.argv[2];
  const mode = process.argv[3] || 'validate';
  let code = fs.readFileSync(file, 'utf8');

  const PLACEHOLDER = '__OPENROUTER_API_KEY__';
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (code.includes(PLACEHOLDER)) {
    if (apiKey) {
      code = code.split(PLACEHOLDER).join(apiKey);
    } else if (mode === 'create' || mode === 'update') {
      console.error(
        'Falta OPENROUTER_API_KEY. Añádela a n8n/.env.local (OPENROUTER_API_KEY=...) o al entorno antes de desplegar.',
      );
      process.exit(1);
    } else {
      // Permite validar el workflow sin la clave real.
      code = code.split(PLACEHOLDER).join('REDACTED');
    }
  }

  // Nunca imprimir la key en la salida (p. ej. al hacer "details").
  const out = (res) => {
    let s = text(res);
    if (apiKey) s = s.split(apiKey).join('***');
    console.log(s);
  };

  if (mode === 'validate') {
    const r = await call('validate_workflow', { code });
    out(r);
  } else if (mode === 'create') {
    const r = await call('create_workflow_from_code', {
      code,
      name: process.argv[4] || 'Mercadona Tickets to InsForge',
      description:
        process.argv[5] || 'Lee los tickets PDF de Mercadona desde Gmail y los sube al bucket mercadona de InsForge.',
    });
    out(r);
  } else if (mode === 'update') {
    const r = await call('update_workflow', {
      workflowId: process.argv[4],
      code,
      name: process.argv[5] || undefined,
      description: process.argv[6] || undefined,
    });
    out(r);
  } else if (mode === 'list') {
    const r = await call('search_workflows', { limit: 20 });
    out(r);
  } else if (mode === 'publish') {
    const r = await call('publish_workflow', { workflowId: process.argv[4] });
    out(r);
  } else if (mode === 'unpublish') {
    const r = await call('unpublish_workflow', { workflowId: process.argv[4] });
    out(r);
  } else if (mode === 'details') {
    const r = await call('get_workflow_details', { workflowId: process.argv[4] });
    out(r);
  } else if (mode === 'archive') {
    const r = await call('archive_workflow', { workflowId: process.argv[4] });
    out(r);
  } else if (mode === 'exec') {
    const r = await call('execute_workflow', {
      workflowId: process.argv[4],
      executionMode: process.argv[5] || 'manual',
    });
    out(r);
  } else if (mode === 'getexec') {
    const r = await call('get_execution', {
      workflowId: process.argv[4],
      executionId: process.argv[5],
      includeData: true,
    });
    out(r);
  }
})();
