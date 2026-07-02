// Vercel serverless function — single proxy endpoint for the Takanock Assistant Hub.
// Routes: chat (Anthropic), request submission (Airtable write), ticket lookup (Airtable read).

const IT_BASE = 'appvNDBoDDGFshd5J';
const IT_TABLE = 'tblVudrEioL0al0co';

const GIS_BASE = 'appvNDBoDDGFshd5J';
const GIS_TABLE = 'tbliYJrSDnWSipK0Z';

const GIS_REQUEST_TYPES = ['New map', 'New data source', 'Presentation support', 'Other'];
const GIS_PRIORITIES = ['High', 'Medium', 'Low'];

const AUTOMATION_BASE = 'appPZMqespKQVOfxo';
const AUTOMATION_TABLE = 'tblfqTJvzI7IW7OiN';

const PROJECT_BASE = 'app8TcmAlSOb6rkYx';
const PROJECT_TABLE = 'tbl9pfOnrPMRccTPn';

const PROJECT_NAMES = ['Baccara', 'Tallmadge', 'Hale', 'Connemara'];
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
    if (body.extract_gis_request) {
      return await handleExtractGisRequest(body.extract_gis_request, res);
    }
    if (body.upload_gis_attachment) {
      return await handleUploadGisAttachment(body.upload_gis_attachment, res);
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

  if (table === 'gis') {
    const fields = {
      'Requester Name': name,
      'Requester Email': email,
      'Project': record.project || '',
      'Request Type': GIS_REQUEST_TYPES.includes(record.requestType) ? record.requestType : 'Other',
      'Description': record.description || ''
    };

    if (record.newDataSourceNeeded === true || record.newDataSourceNeeded === 'true' || record.newDataSourceNeeded === 'on') {
      fields['New Data Source Needed'] = true;
    }
    if (fields['Request Type'] === 'Presentation support') {
      if (record.presentationLink) fields['Presentation Link'] = record.presentationLink;
      if (record.presentationDate) fields['Presentation Date'] = record.presentationDate;
    }
    if (record.finalizeByDate) fields['Finalize By Date'] = record.finalizeByDate;
    if (record.priority && GIS_PRIORITIES.includes(record.priority)) fields['Priority'] = record.priority;
    // Status / Deliverable Link / Deliverable File / Completed At are system-managed — never set from submitter input.

    const data = await airtableCreate(GIS_BASE, GIS_TABLE, fields);
    return res.status(200).json({ id: data.id });
  }

  if (table === 'legal') {
    // Legal still shares the IT table shim for now; prefix the request type so it can be filtered later.
    const requestType = `Legal - ${record.requestType || 'Other'}`;
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
 * GIS hybrid intake: chat -> extract -> confirm
 * --------------------------------------------------------------- */

const GIS_EXTRACTION_TOOL = {
  name: 'submit_gis_request_fields',
  description: 'Extract structured GIS request fields from the conversation so far. Only include fields the user has actually stated or clearly implied; leave a field blank/omitted rather than guessing.',
  input_schema: {
    type: 'object',
    properties: {
      requesterName: { type: 'string', description: 'Requester full name, if stated (blank if not yet given).' },
      project: { type: 'string', description: 'Free-text project name/context this request relates to, if any (e.g. Baccara, Tallmadge, or something not on the known list, or blank).' },
      requestType: { type: 'string', enum: GIS_REQUEST_TYPES },
      description: { type: 'string', description: 'A clear, complete summary of what the requester needs, written in full sentences — this is the primary field Jacob will read.' },
      newDataSourceNeeded: { type: 'boolean', description: 'True only if the conversation indicates a new external data source (e.g. a KMZ from a gas company) needs to be incorporated.' },
      presentationLink: { type: 'string', description: 'Link related to an existing/draft presentation, only if requestType is "Presentation support" and a link was mentioned.' },
      presentationDate: { type: 'string', description: 'ISO date (YYYY-MM-DD) of the actual presentation, only if requestType is "Presentation support" and a date was mentioned.' },
      finalizeByDate: { type: 'string', description: 'ISO date (YYYY-MM-DD) the requester needs the finished deliverable by, if mentioned.' },
      priority: { type: 'string', enum: GIS_PRIORITIES }
    },
    required: ['description']
  }
};

async function handleExtractGisRequest(payload, res) {
  const messages = (payload.messages || []).map((m) => ({ role: m.role, content: m.content }));
  if (!messages.length) {
    return res.status(200).json({ fields: {}, incomplete: true, missingFields: ['description'] });
  }

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: 'You extract structured GIS request data from a conversation between a GIS intake assistant and a Takanock employee. Call submit_gis_request_fields exactly once with the best available values. Leave a field blank/omitted rather than guessing if it was never discussed.',
      messages,
      tools: [GIS_EXTRACTION_TOOL],
      tool_choice: { type: 'tool', name: 'submit_gis_request_fields' }
    })
  });

  const data = await anthropicRes.json();
  if (!anthropicRes.ok) {
    return res.status(anthropicRes.status).json({ error: data.error || data });
  }

  const toolUse = (data.content || []).find((c) => c.type === 'tool_use' && c.name === 'submit_gis_request_fields');
  if (!toolUse) {
    return res.status(200).json({ fields: {}, incomplete: true, missingFields: ['description'] });
  }

  const fields = toolUse.input || {};

  // Server-side validation — never trust the model's enum/free-text output blindly.
  if (!GIS_REQUEST_TYPES.includes(fields.requestType)) fields.requestType = 'Other';
  if (fields.priority && !GIS_PRIORITIES.includes(fields.priority)) fields.priority = '';
  if (fields.requestType !== 'Presentation support') {
    delete fields.presentationLink;
    delete fields.presentationDate;
  }

  const missingDescription = !fields.description || !String(fields.description).trim();

  return res.status(200).json({
    fields,
    incomplete: missingDescription,
    missingFields: missingDescription ? ['description'] : []
  });
}

async function handleUploadGisAttachment(payload, res) {
  const { recordId, filename, contentType, base64Content } = payload;
  if (!recordId || !base64Content) {
    return res.status(400).json({ error: 'recordId and base64Content are required' });
  }

  const url = `https://api.airtable.com/v0/${GIS_BASE}/${GIS_TABLE}/${recordId}/${encodeURIComponent('Uploaded File')}/uploadAttachment`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contentType: contentType || 'application/octet-stream',
      filename: filename || 'upload',
      file: base64Content
    })
  });

  const data = await r.json();
  if (!r.ok) {
    // Non-fatal from the client's perspective — the GIS record already exists.
    return res.status(200).json({ warning: 'attachment_upload_failed', detail: (data.error && data.error.message) || 'Upload failed' });
  }
  return res.status(200).json({ ok: true, attachment: data });
}

/* -----------------------------------------------------------------
 * Ticket lookup
 * --------------------------------------------------------------- */

async function handleLookup(email, res) {
  const safeEmail = String(email).replace(/"/g, '\\"');
  const itFormula = `LOWER({Submitter Email})=LOWER("${safeEmail}")`;
  const gisFormula = `LOWER({Requester Email})=LOWER("${safeEmail}")`;

  const [itRecords, autoRecords, gisRecords] = await Promise.all([
    airtableList(IT_BASE, IT_TABLE, itFormula, AIRTABLE_API_KEY),
    airtableList(AUTOMATION_BASE, AUTOMATION_TABLE, itFormula, AIRTABLE_API_KEY),
    airtableList(GIS_BASE, GIS_TABLE, gisFormula, AIRTABLE_API_KEY)
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
  }))).concat(gisRecords.map((r) => ({
    requestType: `GIS - ${r.fields['Request Type'] || 'Other'}`,
    status: r.fields['Status'] || 'New',
    submittedAt: r.fields['Created At'] || '',
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
