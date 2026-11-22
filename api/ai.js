const fs = require('node:fs');
const path = require('node:path');
const { getKey } = require('../server/getKey');

const MODEL = 'gpt-5.6-luna';

function getBrief() {
  return fs.readFileSync(path.join(process.cwd(), 'BRIEF.md'), 'utf8');
}

function safeError(error) {
  if (error && error.fix) return `${error.message} ${error.fix}`;
  return 'I could not answer right now. Please check your internet connection and try again.';
}

async function askOpenAI({ mode, message, tasks }) {
  const brief = getBrief();
  const system = `${brief}

You are the SchoolScheduler AI. Follow the project brief above. Be friendly, professional, age-appropriate, and safe. Never give harmful directions or invent facts. For factual answers, name trustworthy real sources and be honest when you are uncertain.`;

  const userContent = mode === 'organize'
    ? `Organize these school tasks into the best order for a middle-school student.

Return ONLY valid JSON in this format:
{
  "summary": "short explanation",
  "tasks": [
    {
      "id": "exact task id",
      "title": "exact task text",
      "reason": "one clear sentence explaining its position",
      "category": "Now|Next|Later"
    }
  ],
  "safetyNote": "short reminder"
}

Include every task exactly once.

Tasks:
${JSON.stringify(tasks)}`
    : `The student asks: ${message}

Answer in a few short paragraphs. Put facts first, use real trustworthy sources when making factual claims, and give safe advice suitable for a middle-school student.`;

  async function requestWithKey(force) {
    const key = await getKey({ force });
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
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

module.exports = async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Use POST /api/ai.' });
  }

  try {
    const input = typeof request.body === 'string' ? JSON.parse(request.body) : request.body || {};
    const mode = input.mode === 'talk' ? 'talk' : 'organize';

    if (mode === 'talk' && !String(input.message || '').trim()) {
      return response.status(400).json({ error: 'Type a question first.' });
    }
    if (mode === 'organize' && (!Array.isArray(input.tasks) || input.tasks.length === 0)) {
      return response.status(400).json({ error: 'Add at least one task first.' });
    }

    const answer = await askOpenAI({
      mode,
      message: String(input.message || ''),
      tasks: input.tasks || [],
    });

    if (mode === 'organize') return response.status(200).json({ plan: JSON.parse(answer) });
    return response.status(200).json({ answer });
  } catch (error) {
    return response.status(502).json({ error: safeError(error) });
  }
};
