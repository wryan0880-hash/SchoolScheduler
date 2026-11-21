const http = require('http');
const fs = require('fs');
const path = require('path');
const { getKey } = require('./getKey');

const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');
const port = Number(process.env.PORT || 3000);
const model = 'gpt-5.6-luna';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

loadEnvFile(path.join(root, '.env'));
loadEnvFile(path.join(__dirname, '.env'));

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error('Request is too large.'));
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function safeError(error) {
  if (error && error.fix) return `${error.message} ${error.fix}`;
  return 'I could not answer right now. Please check your internet connection and try again.';
}

async function askOpenAI({ mode, message, tasks }) {
  const brief = fs.readFileSync(path.join(root, 'BRIEF.md'), 'utf8');
  const system = `${brief}\n\nYou are the SchoolScheduler AI inside the Version 1 MVP. Follow the project brief above as your highest-priority instructions. Be friendly, professional, age-appropriate, and safety-minded. Never provide harmful directions. If a question involves health, danger, bullying, self-harm, abuse, or another serious safety issue, encourage the student to talk to a trusted adult or qualified professional and keep the advice general. Do not invent facts or citations. For factual answers, name trustworthy real sources the student can check, and say when you are uncertain.`;

  const userContent = mode === 'organize'
    ? `Organize these school tasks into the best order for a middle-school student. Consider urgency when a due date is written, effort, switching between subjects, and healthy pacing. Do not invent times or deadlines. Return ONLY valid JSON with this shape: {"summary":"short explanation","tasks":[{"id":"the exact task id","title":"the exact task text","reason":"one clear sentence explaining its spot","category":"Now|Next|Later"}],"safetyNote":"short reminder"}. Include every task exactly once. Tasks: ${JSON.stringify(tasks || [])}`
    : `The student asks: ${message}\nAnswer directly in a few short paragraphs. Put facts first, cite real trustworthy websites by name and URL when making factual claims, and be honest if you cannot verify something live. Give practical, safe steps suitable for a middle-school student.`;

  async function requestWithKey(force) {
    const key = await getKey({ force });
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        response_format: mode === 'organize' ? { type: 'json_object' } : undefined,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent },
        ],
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && !force) return requestWithKey(true);
    if (!response.ok) throw new Error(data.error?.message || 'The AI service returned an error.');
    return data.choices?.[0]?.message?.content || '';
  }

  return requestWithKey(false);
}

function serveStatic(request, response) {
  const requested = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const relative = requested === '/' ? 'index.html' : requested.replace(/^\/+/, '');
  const filePath = path.resolve(publicDir, relative);
  if (!filePath.startsWith(publicDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  response.writeHead(200, {
    'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'POST' && request.url === '/api/ai') {
    try {
      const input = JSON.parse(await readBody(request));
      const mode = input.mode === 'talk' ? 'talk' : 'organize';
      if (mode === 'talk' && !String(input.message || '').trim()) {
        return sendJson(response, 400, { error: 'Type a question first.' });
      }
      if (mode === 'organize' && (!Array.isArray(input.tasks) || input.tasks.length === 0)) {
        return sendJson(response, 400, { error: 'Add at least one task first.' });
      }
      const answer = await askOpenAI({ mode, message: String(input.message || ''), tasks: input.tasks });
      if (mode === 'organize') {
        let plan;
        try { plan = JSON.parse(answer); } catch { throw new Error('The AI returned an unreadable plan. Please try again.'); }
        return sendJson(response, 200, { plan });
      }
      return sendJson(response, 200, { answer });
    } catch (error) {
      return sendJson(response, 502, { error: safeError(error) });
    }
  }
  if (request.method === 'GET') return serveStatic(request, response);
  response.writeHead(405);
  response.end('Method not allowed');
});

server.listen(port, () => {
  console.log(`SchoolScheduler is running at http://localhost:${port}`);
});
