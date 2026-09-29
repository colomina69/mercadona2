const fs = require('fs');
const https = require('https');

const MCP_URL = 'https://n8n.benicolo.com/mcp-server/http';
const TOKEN = process.env.N8N_MCP_TOKEN;

function call(tool, args) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: tool, arguments: args }
    });
    const req = https.request(MCP_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + TOKEN,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => {
        const lines = body.split(/\r?\n/).filter(l => l.indexOf('data: ') === 0);
        const raw = lines.length ? lines.map(l => l.slice(6)).join('') : body;
        try { resolve(JSON.parse(raw)); } catch (e) { resolve({ raw: body }); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function text(res) {
  const c = res.result && res.result.content;
  if (c) return c.map(x => x.text || JSON.stringify(x)).join('\n');
  return JSON.stringify(res, null, 2);
}

(async () => {
  const file = process.argv[2];
  const mode = process.argv[3] || 'validate';
  const code = fs.readFileSync(file, 'utf8');

  if (mode === 'validate') {
    const r = await call('validate_workflow', { code });
    console.log(text(r));
  } else if (mode === 'create') {
    const r = await call('create_workflow_from_code', {
      code,
      name: process.argv[4] || 'Mercadona Tickets to InsForge',
      description: process.argv[5] || 'Lee los tickets PDF de Mercadona desde Gmail y los sube al bucket mercadona de InsForge.'
    });
    console.log(text(r));
  } else if (mode === 'update') {
    const r = await call('update_workflow', {
      workflowId: process.argv[4],
      code,
      name: process.argv[5] || undefined,
      description: process.argv[6] || undefined
    });
    console.log(text(r));
  } else if (mode === 'list') {
    const r = await call('search_workflows', { limit: 20 });
    console.log(text(r));
  } else if (mode === 'publish') {
    const r = await call('publish_workflow', { workflowId: process.argv[4] });
    console.log(text(r));
  } else if (mode === 'unpublish') {
    const r = await call('unpublish_workflow', { workflowId: process.argv[4] });
    console.log(text(r));
  } else if (mode === 'details') {
    const r = await call('get_workflow_details', { workflowId: process.argv[4] });
    console.log(text(r));
  } else if (mode === 'archive') {
    const r = await call('archive_workflow', { workflowId: process.argv[4] });
    console.log(text(r));
  } else if (mode === 'exec') {
    const r = await call('execute_workflow', {
      workflowId: process.argv[4],
      executionMode: process.argv[5] || 'manual'
    });
    console.log(text(r));
  } else if (mode === 'getexec') {
    const r = await call('get_execution', {
      workflowId: process.argv[4],
      executionId: process.argv[5],
      includeData: true
    });
    console.log(text(r));
  }
})();
