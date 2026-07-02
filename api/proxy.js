// Vercel serverless function — single proxy endpoint for the Takanock Assistant Hub.
// Routes: chat (Anthropic), request submission (Airtable write), ticket lookup (Airtable read).

const IT_BASE = 'appvNDBoDDGFshd5J';
const IT_TABLE = 'tblVudrEioL0al0co';

const AUTOMATION_BASE = 'appPZMqespKQVOfxo';
const AUTOMATION_TABLE = 'tblfqTJvzI7IW7OiN';

const PROJECT_BASE = 'app8TcmAlSOb6rkYx';
const PROJECT_TABLE = 'tbl9pfOnrPMRccTPn';

const PROJECT_NAMES = ['Baccara', 'Tallmadge', 'Connemara', 'Hale', 'Pacara', 'Glendale', 'Koneman'];
const PROJECT_TRIGGER_KEYWORDS = ['baccara', 'tallmadge', 'hale', 'connemara', 'project', 'status', 'stage', 'phase'];

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_DEV_READ_TOKEN = process.env.AIRTABLE_DEV_READ_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  try {
    if (body.lookup_email) {
      return await handleLookup(body.lookup_email, res);
    }
    if (body.airtable_record && body.table) {
      return await handleSubmit(body.airtable_record, body.table, res);
    }
    if (body.messages) {
      return await handleChat(body, res);
    }
    res.status(400).json({ error: 'Invalid request body' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

/* -----------------------------------------------------------------
 * Airtable helpers
 * --------------------------------------------------------------- */

async function airtableCreate(baseId, tableId, fields) {
  const url = `https://api.airtable.com/v0/${baseId}/${tableId}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields })
  });
  const data = await r.json();
  if (!r.ok) {
    throw new Error((data && data.error && (data.error.message || data.error.type)) || 'Airtable write failed');
  }
  return data;
}

async function airtableList(baseId, tableId, formula, token) {
  const url = `https://api.airtable.com/v0/${baseId}/${tableId}?filterByFormula=${encodeURIComponent(formula)}&pageSize=100`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await r.json();
  if (!r.ok) {
    throw new Error((data && data.error && (data.error.message || data.error.type)) || 'Airtable read failed');
  }
  return data.records || [];
}

/* -----------------------------------------------------------------
 * Request submission
 * --------------------------------------------------------------- */

async function handleSubmit(record, table, res) {
  const name = record.name || '';
  const email = record.email || '';
  const department = record.department || '';
  const now = new Date().toISOString();

  if (table === 'it') {
    const fields = {
      'Submitter Name': name,
      'Submitter Email': email,
      'Department': department,
      'Request Type': record.requestType || '',
      'Request Description': record.description || '',
      'Urgency': record.urgency || '',
      'Input Channel': 'Hub',
      'Status': 'New',
      'Submitted At': now
    };
    const data = await airtableCreate(IT_BASE, IT_TABLE, fields);
    return res.status(200).json({ id: data.id });
  }

  if (table === 'automation') {
    const fields = {
      'Title': record.title || '',
      'Submitter Name': name,
      'Submitter Email': email,
      'Department': department,
      'Description': record.description || '',
      'Business Problem': record.businessProblem || '',
      'Current Process': record.currentProcess || '',
      'Submitter Priority': record.priority || '',
      'Submitted Date': now.slice(0, 10)
    };
    const data = await airtableCreate(AUTOMATION_BASE, AUTOMATION_TABLE, fields);
    return res.status(200).json({ id: data.id });
  }

  if (table === 'gis' || table === 'legal') {
    // GIS/Legal share the IT table for now; prefix the request type so it can be filtered later.
    const prefix = table === 'gis' ? 'GIS' : 'Legal';
    const requestType = `${prefix} - ${record.requestType || 'Other'}`;
    const urgency = record.urgency || record.priority || '';
    let description = record.description || '';
    if (record.project) description = `[Project: ${record.project}] ${description}`;

    const fields = {
      'Submitter Name': name,
      'Submitter Email': email,
      'Department': department,
      'Request Type': requestType,
      'Request Description': description,
      'Urgency': urgency,
      'Input Channel': 'Hub',
      'Status': 'New',
      'Submitted At': now
    };
    const data = await airtableCreate(IT_BASE, IT_TABLE, fields);
    return res.status(200).json({ id: data.id });
  }

  return res.status(400).json({ error: `Unknown table type: ${table}` });
}

/* -----------------------------------------------------------------
 * Ticket lookup
 * --------------------------------------------------------------- */

async function handleLookup(email, res) {
  const safeEmail = String(email).replace(/"/g, '\\"');
  const formula = `LOWER({Submitter Email})=LOWER("${safeEmail}")`;

  const [itRecords, autoRecords] = await Promise.all([
    airtableList(IT_BASE, IT_TABLE, formula, AIRTABLE_API_KEY),
    airtableList(AUTOMATION_BASE, AUTOMATION_TABLE, formula, AIRTABLE_API_KEY)
  ]);

  const tickets = itRecords.map((r) => ({
    requestType: r.fields['Request Type'] || '',
    status: r.fields['Status'] || 'New',
    submittedAt: r.fields['Submitted At'] || '',
    description: r.fields['Request Description'] || ''
  })).concat(autoRecords.map((r) => ({
    requestType: `Automation - ${r.fields['Title'] || 'Untitled'}`,
    status: r.fields['Status'] || 'New',
    submittedAt: r.fields['Submitted Date'] || '',
    description: r.fields['Description'] || ''
  })));

  tickets.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  return res.status(200).json(tickets);
}

/* -----------------------------------------------------------------
 * Chat (Anthropic) with live project data injection
 * --------------------------------------------------------------- */

function detectProjectMention(text) {
  const lower = text.toLowerCase();
  return PROJECT_NAMES.find((p) => lower.indexOf(p.toLowerCase()) !== -1) || null;
}

async function fetchProjectContext(lastUserMessage) {
  const lower = lastUserMessage.toLowerCase();
  const hasTrigger = PROJECT_TRIGGER_KEYWORDS.some((k) => lower.indexOf(k) !== -1);
  if (!hasTrigger) return null;

  const mentionedProject = detectProjectMention(lastUserMessage);
  let url = `https://api.airtable.com/v0/${PROJECT_BASE}/${PROJECT_TABLE}?pageSize=100`;
  if (mentionedProject) {
    const formula = `SEARCH(LOWER("${mentionedProject.toLowerCase()}"), LOWER({Project}))`;
    url += `&filterByFormula=${encodeURIComponent(formula)}`;
  }

  const r = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_DEV_READ_TOKEN}` } });
  if (!r.ok) return null; // fail soft — chat should still work without live project context
  const data = await r.json();
  return (data.records || []).map((rec) => rec.fields);
}

async function handleChat(body, res) {
  const messages = body.messages || [];
  let system = body.system || '';

  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  if (lastUserMsg && lastUserMsg.content) {
    const projectContext = await fetchProjectContext(String(lastUserMsg.content)).catch(() => null);
    if (projectContext && projectContext.length) {
      system += `\n\nLive project data from the internal tracker (use this to answer project questions accurately):\n${JSON.stringify(projectContext)}`;
    }
  }

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: body.model || 'claude-sonnet-4-6',
      max_tokens: body.max_tokens || 1000,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content }))
    })
  });

  const data = await anthropicRes.json();
  if (!anthropicRes.ok) {
    return res.status(anthropicRes.status).json({ error: data.error || data });
  }
  return res.status(200).json(data);
}
