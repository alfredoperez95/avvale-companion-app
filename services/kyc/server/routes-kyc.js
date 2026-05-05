// Workzone KYC — REST routes mounted under /api/kyc/*
// Docker slice: news_clients mirror and scraper are removed.
// Claude CLI receives a per-request ANTHROPIC_API_KEY (from X-Anthropic-Key header).

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const db = require('./db-pg');

const PROFILE_BLOCKS = ['economics', 'business_model', 'customers', 'tech_stack', 'critical_processes', 'sector_context'];

const SESSIONS_ROOT = process.env.KYC_SESSIONS_DIR || path.join(__dirname, '..', 'kyc-sessions');
if (!fs.existsSync(SESSIONS_ROOT)) fs.mkdirSync(SESSIONS_ROOT, { recursive: true });

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function completenessScore(profile) {
  if (!profile) return 0;
  let filled = 0;
  for (const b of PROFILE_BLOCKS) {
    const v = profile[b];
    if (v && typeof v === 'object' && Object.keys(v).length > 0) filled += 1;
  }
  if (profile.summary && profile.summary.length > 20) filled += 1;
  return Math.round((filled / (PROFILE_BLOCKS.length + 1)) * 100);
}

async function loadFullProfile(companyId) {
  const co = await db.query('SELECT * FROM companies WHERE id = $1', [companyId]);
  if (!co.rows.length) return null;
  const prof = await db.query('SELECT * FROM kyc_profiles WHERE company_id = $1', [companyId]);
  const members = await db.query('SELECT * FROM kyc_org_members WHERE company_id = $1 ORDER BY level NULLS LAST, name', [companyId]);
  const rels = await db.query('SELECT * FROM kyc_org_relationships WHERE company_id = $1', [companyId]);
  const signals = await db.query(
    'SELECT * FROM kyc_signals WHERE company_id = $1 ORDER BY COALESCE(published_at, captured_at) DESC LIMIT 50',
    [companyId]
  );
  const openQs = await db.query(
    `SELECT * FROM kyc_open_questions WHERE company_id = $1 AND status = 'open' ORDER BY priority ASC, id ASC`,
    [companyId]
  );
  return {
    company: co.rows[0],
    profile: prof.rows[0] || null,
    completeness: completenessScore(prof.rows[0]),
    org: { members: members.rows, relationships: rels.rows },
    signals: signals.rows,
    open_questions: openQs.rows,
  };
}

async function applyProposedUpdates(companyId, workdir) {
  const file = path.join(workdir, 'PROPOSED_UPDATES.json');
  if (!fs.existsSync(file)) return { applied: 0 };
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch { return { applied: 0 }; }
  let items;
  try { items = JSON.parse(raw); } catch { return { applied: 0, error: 'invalid json' }; }
  if (!Array.isArray(items)) items = [items];
  let applied = 0;
  await ensureProfile(companyId);
  for (const up of items) {
    try {
      const fp = up.field_path;
      const val = up.value;
      if (!fp) continue;

      if (fp === 'open_question') {
        if (!val || !val.question) continue;
        await db.query(
          `INSERT INTO kyc_open_questions (company_id, topic, question, priority, source)
           VALUES ($1, $2, $3, COALESCE($4, 2), COALESCE($5, 'intake'))`,
          [companyId, val.topic || 'general', val.question, val.priority || 2, up.source || 'intake']
        );
        applied += 1;
        continue;
      }

      if (fp === 'org_member') {
        if (!val || !val.name) continue;
        await db.query(
          `INSERT INTO kyc_org_members (company_id, name, role, area, linkedin, notes, source)
           VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'intake'))`,
          [companyId, val.name, val.role || null, val.area || null, val.linkedin || null, val.notes || null, up.source || 'intake']
        );
        applied += 1;
        continue;
      }

      if (fp === 'summary') {
        await db.query('UPDATE kyc_profiles SET summary = $1 WHERE company_id = $2', [String(val || ''), companyId]);
        await recordFact(companyId, 'summary', val, null, up.source || 'intake', null, null);
        applied += 1;
        continue;
      }

      const [block, ...rest] = fp.split('.');
      if (PROFILE_BLOCKS.includes(block)) {
        if (rest.length === 0) {
          const prev = await db.query(`SELECT ${block} FROM kyc_profiles WHERE company_id = $1`, [companyId]);
          const merged = { ...(prev.rows[0]?.[block] || {}), ...(typeof val === 'object' && val ? val : { value: val }) };
          await db.query(`UPDATE kyc_profiles SET ${block} = $1::jsonb WHERE company_id = $2`, [JSON.stringify(merged), companyId]);
        } else {
          const prev = await db.query(`SELECT ${block} FROM kyc_profiles WHERE company_id = $1`, [companyId]);
          const current = { ...(prev.rows[0]?.[block] || {}) };
          let node = current;
          for (let i = 0; i < rest.length - 1; i++) {
            node[rest[i]] = node[rest[i]] && typeof node[rest[i]] === 'object' ? node[rest[i]] : {};
            node = node[rest[i]];
          }
          node[rest[rest.length - 1]] = val;
          await db.query(`UPDATE kyc_profiles SET ${block} = $1::jsonb WHERE company_id = $2`, [JSON.stringify(current), companyId]);
        }
        await recordFact(companyId, fp, val, null, up.source || 'intake', null, null);
        applied += 1;
      }
    } catch (e) {
      console.error('[applyProposedUpdates]', e.message, up);
    }
  }
  try { fs.renameSync(file, path.join(workdir, `PROPOSED_UPDATES.applied.${Date.now()}.json`)); } catch {}
  return { applied };
}

async function writeContextFile(companyId, workdir) {
  const data = await loadFullProfile(companyId);
  if (!data) return null;
  const lines = [];
  lines.push(`# KYC Context — ${data.company.name}`);
  lines.push('');
  lines.push(`**Company ID:** ${data.company.id}`);
  lines.push(`**Sector:** ${data.company.sector || '—'}`);
  lines.push(`**Website:** ${data.company.website || '—'}`);
  lines.push(`**City:** ${data.company.city || '—'}`);
  lines.push(`**Revenue:** ${data.company.revenue || '—'}`);
  lines.push(`**Employees:** ${data.company.employees || '—'}`);
  lines.push(`**Tech stack:** ${data.company.tech_stack || '—'}`);
  lines.push('');
  if (data.profile) {
    lines.push(`**Completeness:** ${data.completeness}%`);
    lines.push(`**Summary:** ${data.profile.summary || '—'}`);
    lines.push('');
    for (const b of PROFILE_BLOCKS) {
      lines.push(`## ${b}`);
      lines.push('```json');
      lines.push(JSON.stringify(data.profile[b] || {}, null, 2));
      lines.push('```');
      lines.push('');
    }
  } else {
    lines.push('_KYC profile not yet activated for this company._');
  }
  if (data.org.members.length) {
    lines.push('## Org members');
    for (const m of data.org.members) {
      lines.push(`- **${m.name}** — ${m.role || '—'} (${m.area || ''}) [id=${m.id}]`);
    }
    lines.push('');
  }
  if (data.signals.length) {
    lines.push('## Recent signals');
    for (const s of data.signals.slice(0, 15)) {
      lines.push(`- [${s.source}] ${s.title || s.text?.slice(0, 100) || '—'} (${s.sentiment || ''})`);
    }
    lines.push('');
  }
  if (data.open_questions && data.open_questions.length) {
    lines.push('## Preguntas abiertas (Por resolver)');
    for (const q of data.open_questions) {
      lines.push(`- [${q.topic}] ${q.question}`);
    }
    lines.push('');
  }
  const file = path.join(workdir, 'CONTEXT.md');
  fs.writeFileSync(file, lines.join('\n'));
  return file;
}

async function ensureProfile(companyId) {
  await db.query(
    'INSERT INTO kyc_profiles (company_id) VALUES ($1) ON CONFLICT (company_id) DO NOTHING',
    [companyId]
  );
}

async function recordFact(companyId, fieldPath, value, prevValue, source, userId, chatMessageId) {
  await db.query(
    `INSERT INTO kyc_facts (company_id, field_path, value, prev_value, source, user_id, chat_message_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [companyId, fieldPath, value, prevValue, source, userId || null, chatMessageId || null]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SSE helpers
// ─────────────────────────────────────────────────────────────────────────────
function sseInit(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
}
function sseSend(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Claude CLI runner — API key is passed in from the HTTP request
// ─────────────────────────────────────────────────────────────────────────────
function runClaudeStream({ workdir, prompt, apiKey, onText, onDone, onError }) {
  const args = [
    '-p', prompt,
    '--output-format', 'stream-json',
    '--verbose',
    '--dangerously-skip-permissions',
    '--allowedTools', 'WebSearch WebFetch Read Write Edit Bash Grep Glob',
  ];
  const env = { ...process.env };
  if (apiKey) env.ANTHROPIC_API_KEY = apiKey;
  const child = spawn('claude', args, { cwd: workdir, env });
  let buf = '';
  child.stdout.on('data', (chunk) => {
    buf += chunk.toString('utf8');
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.type === 'assistant' && obj.message?.content) {
          for (const c of obj.message.content) {
            if (c.type === 'text' && c.text) onText(c.text);
          }
        } else if (obj.type === 'result') {
          onText('');
        }
      } catch {
        onText(line + '\n');
      }
    }
  });
  child.stderr.on('data', (d) => { console.error('[claude stderr]', d.toString().slice(0, 300)); });
  child.on('error', (err) => onError(err.message));
  child.on('close', (code) => onDone(code));
  return child;
}

// ─────────────────────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────────────────────
async function handle(req, res, ctx) {
  const { route, url, method, parseBody, respond } = ctx;
  if (!route.startsWith('/api/kyc/')) return false;

  // ─── Companies listing ─────────────────────────────────────────────────
  if (route === '/api/kyc/companies' && method === 'GET') {
    const q = url.searchParams.get('q') || '';
    const strategic = url.searchParams.get('strategic');
    const all = url.searchParams.get('all') === 'true';
    const where = []; const params = []; let p = 0;
    if (!all) where.push('kp.company_id IS NOT NULL');
    if (q) { params.push(`%${q}%`); where.push(`co.name ILIKE $${++p}`); }
    if (strategic === 'true') { where.push(`kp.strategic = true`); }
    const r = await db.query(
      `SELECT co.id, co.name, co.sector, co.industry, co.website, co.city, co.revenue, co.employees,
              (kp.company_id IS NOT NULL) AS kyc_active,
              kp.strategic, kp.last_enriched_at, kp.summary, kp.confidence_score,
              kp.economics, kp.business_model, kp.tech_stack,
              (SELECT COUNT(*)::int FROM kyc_signals s WHERE s.company_id = co.id) AS signal_count,
              (SELECT COUNT(*)::int FROM kyc_org_members m WHERE m.company_id = co.id) AS org_count
       FROM companies co
       LEFT JOIN kyc_profiles kp ON kp.company_id = co.id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY kp.strategic DESC NULLS LAST, co.name ASC LIMIT 500`,
      params
    );
    const rows = r.rows.map((row) => ({
      ...row,
      completeness: completenessScore({
        economics: row.economics, business_model: row.business_model, tech_stack: row.tech_stack,
        customers: {}, critical_processes: {}, sector_context: {}, summary: row.summary,
      }),
    }));
    return respond(res, 200, rows);
  }

  // ─── Create new client ─────────────────────────────────────────────────
  if (route === '/api/kyc/companies' && method === 'POST') {
    const body = await parseBody(req);
    if (!body.name || !body.name.trim()) return respond(res, 400, { error: 'name required' });
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      let companyId;
      if (body.company_id) {
        const exists = await client.query('SELECT id FROM companies WHERE id = $1', [body.company_id]);
        if (!exists.rows.length) { await client.query('ROLLBACK'); return respond(res, 404, { error: 'Company not found' }); }
        companyId = body.company_id;
      } else {
        const dup = await client.query('SELECT id FROM companies WHERE lower(name) = lower($1)', [body.name.trim()]);
        if (dup.rows.length) {
          companyId = dup.rows[0].id;
        } else {
          const ins = await client.query(
            `INSERT INTO companies (name, sector, industry, city, country, website, revenue, employees, tech_stack, notes, source)
             VALUES ($1, $2, $3, $4, COALESCE($5, 'Spain'), $6, $7, $8, $9, $10, COALESCE($11, 'kyc'))
             RETURNING id`,
            [body.name.trim(), body.sector || null, body.industry || null, body.city || null, body.country || null,
             body.website || null, body.revenue || null, body.employees || null,
             body.tech_stack || null, body.notes || null, body.source]
          );
          companyId = ins.rows[0].id;
        }
      }
      await client.query(
        'INSERT INTO kyc_profiles (company_id, strategic) VALUES ($1, COALESCE($2, false)) ON CONFLICT (company_id) DO NOTHING',
        [companyId, body.strategic]
      );
      await client.query('COMMIT');
      return respond(res, 201, { id: companyId, ok: true });
    } catch (e) {
      await client.query('ROLLBACK');
      return respond(res, 400, { error: e.message });
    } finally {
      client.release();
    }
  }

  // ─── Bulk delete ────────────────────────────────────────────────────────
  if (route === '/api/kyc/companies/bulk-delete' && method === 'POST') {
    const body = await parseBody(req);
    const ids = Array.isArray(body.ids) ? body.ids.map((x) => parseInt(x)).filter(Boolean) : [];
    if (!ids.length) return respond(res, 400, { error: 'ids array required' });
    const r = await db.query('DELETE FROM kyc_profiles WHERE company_id = ANY($1::bigint[]) RETURNING company_id', [ids]);
    await db.query('DELETE FROM kyc_org_relationships WHERE company_id = ANY($1::bigint[])', [ids]);
    await db.query('DELETE FROM kyc_org_members WHERE company_id = ANY($1::bigint[])', [ids]);
    await db.query('DELETE FROM kyc_signals WHERE company_id = ANY($1::bigint[])', [ids]);
    await db.query('DELETE FROM kyc_chat_sessions WHERE company_id = ANY($1::bigint[])', [ids]);
    return respond(res, 200, { deleted: r.rows.length });
  }

  // ─── Bulk import ────────────────────────────────────────────────────────
  if (route === '/api/kyc/companies/import' && method === 'POST') {
    const body = await parseBody(req);
    const rows = Array.isArray(body.companies) ? body.companies : [];
    if (!rows.length) return respond(res, 400, { error: 'companies array required' });
    const client = await db.pool.connect();
    const result = { imported: 0, activated: 0, skipped: 0, errors: [] };
    try {
      for (const row of rows) {
        const name = (row.name || '').trim();
        if (!name) { result.skipped += 1; continue; }
        try {
          const dup = await client.query('SELECT id FROM companies WHERE lower(name) = lower($1)', [name]);
          let companyId;
          if (dup.rows.length) {
            companyId = dup.rows[0].id;
          } else {
            const ins = await client.query(
              `INSERT INTO companies (name, sector, city, country, website, revenue, employees, source)
               VALUES ($1, $2, $3, COALESCE($4, 'Spain'), $5, $6, $7, 'kyc-import')
               RETURNING id`,
              [name, row.sector || null, row.city || null, row.country || null,
               row.website || null, row.revenue || null, row.employees || null]
            );
            companyId = ins.rows[0].id;
            result.imported += 1;
          }
          const act = await client.query(
            'INSERT INTO kyc_profiles (company_id) VALUES ($1) ON CONFLICT (company_id) DO NOTHING RETURNING company_id',
            [companyId]
          );
          if (act.rows.length) result.activated += 1;
        } catch (e) {
          result.errors.push({ name, error: e.message });
        }
      }
      return respond(res, 200, result);
    } finally {
      client.release();
    }
  }

  // ─── Full profile ───────────────────────────────────────────────────────
  const mCompany = route.match(/^\/api\/kyc\/companies\/(\d+)$/);
  if (mCompany && method === 'GET') {
    const data = await loadFullProfile(parseInt(mCompany[1]));
    if (!data) return respond(res, 404, { error: 'Not found' });
    return respond(res, 200, data);
  }

  if (mCompany && method === 'DELETE') {
    const id = parseInt(mCompany[1]);
    const r = await db.query('DELETE FROM kyc_profiles WHERE company_id = $1 RETURNING company_id', [id]);
    if (!r.rows.length) return respond(res, 404, { error: 'Not in KYC' });
    await db.query('DELETE FROM kyc_org_relationships WHERE company_id = $1', [id]);
    await db.query('DELETE FROM kyc_org_members WHERE company_id = $1', [id]);
    await db.query('DELETE FROM kyc_signals WHERE company_id = $1', [id]);
    await db.query('DELETE FROM kyc_chat_sessions WHERE company_id = $1', [id]);
    return respond(res, 200, { ok: true });
  }

  const mActivate = route.match(/^\/api\/kyc\/companies\/(\d+)\/activate$/);
  if (mActivate && method === 'POST') {
    const id = parseInt(mActivate[1]);
    const co = await db.query('SELECT id FROM companies WHERE id = $1', [id]);
    if (!co.rows.length) return respond(res, 404, { error: 'Company not found' });
    await ensureProfile(id);
    return respond(res, 201, { ok: true, company_id: id });
  }

  const mProfile = route.match(/^\/api\/kyc\/companies\/(\d+)\/profile$/);
  if (mProfile && method === 'PATCH') {
    const id = parseInt(mProfile[1]);
    const body = await parseBody(req);
    await ensureProfile(id);
    const updates = []; const vals = []; let i = 0;
    for (const b of PROFILE_BLOCKS) {
      if (body[b] !== undefined) {
        vals.push(JSON.stringify(body[b])); updates.push(`${b} = $${++i}::jsonb`);
      }
    }
    if (body.summary !== undefined) { vals.push(body.summary); updates.push(`summary = $${++i}`); }
    if (body.strategic !== undefined) { vals.push(!!body.strategic); updates.push(`strategic = $${++i}`); }
    if (body.confidence_score !== undefined) { vals.push(body.confidence_score); updates.push(`confidence_score = $${++i}`); }
    if (!updates.length) return respond(res, 400, { error: 'No fields' });
    vals.push(id);
    const r = await db.query(
      `UPDATE kyc_profiles SET ${updates.join(', ')} WHERE company_id = $${++i} RETURNING *`,
      vals
    );
    for (const b of PROFILE_BLOCKS) {
      if (body[b] !== undefined) await recordFact(id, b, body[b], null, 'manual', null, null);
    }
    return respond(res, 200, r.rows[0]);
  }

  // ─── Timeline (signals only in this slice) ──────────────────────────────
  const mTimeline = route.match(/^\/api\/kyc\/companies\/(\d+)\/timeline$/);
  if (mTimeline && method === 'GET') {
    const id = parseInt(mTimeline[1]);
    const signals = await db.query(
      'SELECT id, source, source_url, title, text, sentiment, signal_type, COALESCE(published_at, captured_at) AS ts FROM kyc_signals WHERE company_id = $1',
      [id]
    );
    const items = signals.rows.map((s) => ({ kind: 'signal', ...s }))
      .sort((a, b) => new Date(b.ts) - new Date(a.ts));
    return respond(res, 200, items);
  }

  // ─── Enrich is disabled in this slice ───────────────────────────────────
  const mEnrich = route.match(/^\/api\/kyc\/companies\/(\d+)\/enrich$/);
  if (mEnrich && method === 'POST') {
    return respond(res, 501, { error: 'enrich (scraping) not available in this build' });
  }

  // ─── Org: members ───────────────────────────────────────────────────────
  const mOrg = route.match(/^\/api\/kyc\/companies\/(\d+)\/org$/);
  if (mOrg && method === 'GET') {
    const id = parseInt(mOrg[1]);
    const members = await db.query('SELECT * FROM kyc_org_members WHERE company_id = $1 ORDER BY level NULLS LAST, name', [id]);
    const rels = await db.query('SELECT * FROM kyc_org_relationships WHERE company_id = $1', [id]);
    return respond(res, 200, { members: members.rows, relationships: rels.rows });
  }

  const mAddMember = route.match(/^\/api\/kyc\/companies\/(\d+)\/org\/members$/);
  if (mAddMember && method === 'POST') {
    const id = parseInt(mAddMember[1]);
    const body = await parseBody(req);
    if (!body.name) return respond(res, 400, { error: 'name required' });
    const r = await db.query(
      `INSERT INTO kyc_org_members (company_id, contact_id, name, role, area, level, reports_to_id, linkedin, notes, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, 'manual'))
       RETURNING *`,
      [id, body.contact_id || null, body.name, body.role || null, body.area || null,
       body.level || null, body.reports_to_id || null, body.linkedin || null, body.notes || null, body.source]
    );
    return respond(res, 201, r.rows[0]);
  }

  const mMember = route.match(/^\/api\/kyc\/org\/members\/(\d+)$/);
  if (mMember && method === 'PATCH') {
    const id = parseInt(mMember[1]);
    const body = await parseBody(req);
    const fields = ['name','role','area','level','reports_to_id','linkedin','notes','contact_id'];
    const updates = []; const vals = []; let i = 0;
    for (const f of fields) {
      if (body[f] !== undefined) { vals.push(body[f]); updates.push(`${f} = $${++i}`); }
    }
    if (!updates.length) return respond(res, 400, { error: 'No fields' });
    vals.push(id);
    const r = await db.query(`UPDATE kyc_org_members SET ${updates.join(', ')} WHERE id = $${++i} RETURNING *`, vals);
    if (!r.rows.length) return respond(res, 404, { error: 'Not found' });
    return respond(res, 200, r.rows[0]);
  }
  if (mMember && method === 'DELETE') {
    const r = await db.query('DELETE FROM kyc_org_members WHERE id = $1 RETURNING id', [parseInt(mMember[1])]);
    if (!r.rows.length) return respond(res, 404, { error: 'Not found' });
    return respond(res, 200, { ok: true });
  }

  // ─── Org: informal relationships ────────────────────────────────────────
  const mAddRel = route.match(/^\/api\/kyc\/companies\/(\d+)\/org\/relationships$/);
  if (mAddRel && method === 'POST') {
    const id = parseInt(mAddRel[1]);
    const body = await parseBody(req);
    if (!body.from_member_id || !body.to_member_id || !body.type) {
      return respond(res, 400, { error: 'from_member_id, to_member_id, type required' });
    }
    const r = await db.query(
      `INSERT INTO kyc_org_relationships (company_id, from_member_id, to_member_id, type, strength, notes)
       VALUES ($1, $2, $3, $4, COALESCE($5, 3), $6) RETURNING *`,
      [id, body.from_member_id, body.to_member_id, body.type, body.strength, body.notes || null]
    );
    return respond(res, 201, r.rows[0]);
  }
  const mRel = route.match(/^\/api\/kyc\/org\/relationships\/(\d+)$/);
  if (mRel && method === 'DELETE') {
    const r = await db.query('DELETE FROM kyc_org_relationships WHERE id = $1 RETURNING id', [parseInt(mRel[1])]);
    if (!r.rows.length) return respond(res, 404, { error: 'Not found' });
    return respond(res, 200, { ok: true });
  }

  // ─── Signals ────────────────────────────────────────────────────────────
  const mSignals = route.match(/^\/api\/kyc\/companies\/(\d+)\/signals$/);
  if (mSignals && method === 'GET') {
    const id = parseInt(mSignals[1]);
    const r = await db.query(
      `SELECT * FROM kyc_signals WHERE company_id = $1
       ORDER BY COALESCE(published_at, captured_at) DESC LIMIT 200`, [id]);
    return respond(res, 200, r.rows);
  }
  if (mSignals && method === 'POST') {
    const id = parseInt(mSignals[1]);
    const body = await parseBody(req);
    const r = await db.query(
      `INSERT INTO kyc_signals (company_id, source, source_url, sentiment, rating, title, text, signal_type, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'note'), $9) RETURNING *`,
      [id, body.source || 'manual', body.source_url || null, body.sentiment || null,
       body.rating || null, body.title || null, body.text || null, body.signal_type, body.published_at || null]
    );
    return respond(res, 201, r.rows[0]);
  }

  // ─── Open questions ─────────────────────────────────────────────────────
  const mOpenQs = route.match(/^\/api\/kyc\/companies\/(\d+)\/open-questions$/);
  if (mOpenQs && method === 'GET') {
    const id = parseInt(mOpenQs[1]);
    const status = url.searchParams.get('status') || 'open';
    const r = await db.query(
      `SELECT * FROM kyc_open_questions WHERE company_id = $1 AND status = $2
       ORDER BY priority ASC, id ASC`,
      [id, status]
    );
    return respond(res, 200, r.rows);
  }
  if (mOpenQs && method === 'POST') {
    const id = parseInt(mOpenQs[1]);
    const body = await parseBody(req);
    if (!body.question) return respond(res, 400, { error: 'question required' });
    const r = await db.query(
      `INSERT INTO kyc_open_questions (company_id, topic, question, priority, source)
       VALUES ($1, $2, $3, COALESCE($4, 2), COALESCE($5, 'manual')) RETURNING *`,
      [id, body.topic || 'general', body.question, body.priority, body.source]
    );
    return respond(res, 201, r.rows[0]);
  }

  const mOpenQ = route.match(/^\/api\/kyc\/open-questions\/(\d+)$/);
  if (mOpenQ && method === 'PATCH') {
    const id = parseInt(mOpenQ[1]);
    const body = await parseBody(req);
    const updates = []; const vals = []; let i = 0;
    if (body.question !== undefined) { vals.push(body.question); updates.push(`question = $${++i}`); }
    if (body.topic !== undefined) { vals.push(body.topic); updates.push(`topic = $${++i}`); }
    if (body.priority !== undefined) { vals.push(body.priority); updates.push(`priority = $${++i}`); }
    if (body.answer !== undefined) { vals.push(body.answer); updates.push(`answer = $${++i}`); }
    if (body.status !== undefined) {
      vals.push(body.status); updates.push(`status = $${++i}`);
      if (body.status === 'resolved' || body.status === 'skipped') {
        updates.push(`resolved_at = now()`);
      }
    }
    if (!updates.length) return respond(res, 400, { error: 'No fields' });
    vals.push(id);
    const r = await db.query(
      `UPDATE kyc_open_questions SET ${updates.join(', ')} WHERE id = $${++i} RETURNING *`,
      vals
    );
    if (!r.rows.length) return respond(res, 404, { error: 'Not found' });
    return respond(res, 200, r.rows[0]);
  }
  if (mOpenQ && method === 'DELETE') {
    const r = await db.query('DELETE FROM kyc_open_questions WHERE id = $1 RETURNING id', [parseInt(mOpenQ[1])]);
    if (!r.rows.length) return respond(res, 404, { error: 'Not found' });
    return respond(res, 200, { ok: true });
  }

  // ─── Chat sessions ──────────────────────────────────────────────────────
  const mSessions = route.match(/^\/api\/kyc\/companies\/(\d+)\/chat\/sessions$/);
  if (mSessions && method === 'GET') {
    const id = parseInt(mSessions[1]);
    const r = await db.query(
      'SELECT * FROM kyc_chat_sessions WHERE company_id = $1 ORDER BY updated_at DESC', [id]);
    return respond(res, 200, r.rows);
  }
  if (mSessions && method === 'POST') {
    const id = parseInt(mSessions[1]);
    const body = await parseBody(req);
    const sessionType = body.type === 'intake' ? 'intake' : 'research';
    const defaultTitle = sessionType === 'intake' ? 'Entrevista guiada' : 'Investigación KYC';
    const ins = await db.query(
      'INSERT INTO kyc_chat_sessions (company_id, title, session_type, user_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, body.title || defaultTitle, sessionType, ctx.user?.sub || null]
    );
    const session = ins.rows[0];
    const workdir = path.join(SESSIONS_ROOT, `company-${id}-session-${session.id}`);
    fs.mkdirSync(workdir, { recursive: true });
    await db.query('UPDATE kyc_chat_sessions SET workdir = $1 WHERE id = $2', [workdir, session.id]);
    session.workdir = workdir;
    return respond(res, 201, session);
  }

  const mMessages = route.match(/^\/api\/kyc\/chat\/sessions\/(\d+)\/messages$/);
  if (mMessages && method === 'GET') {
    const id = parseInt(mMessages[1]);
    const r = await db.query(
      'SELECT id, role, content, meta, created_at FROM kyc_chat_messages WHERE session_id = $1 ORDER BY id ASC', [id]);
    return respond(res, 200, r.rows);
  }

  // ─── Chat stream (SSE → Claude CLI) ─────────────────────────────────────
  const mStream = route.match(/^\/api\/kyc\/chat\/sessions\/(\d+)\/stream$/);
  if (mStream && method === 'POST') {
    // API key: prefer per-request header; fall back to env if provided at runtime.
    const apiKey = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return respond(res, 400, { error: 'Falta la API key de Anthropic. Configúrala en ⚙️ Ajustes.' });
    }

    const sessionId = parseInt(mStream[1]);
    const body = await parseBody(req);
    const userMessage = (body.message || '').toString().trim();
    if (!userMessage) return respond(res, 400, { error: 'message required' });

    const sRes = await db.query('SELECT * FROM kyc_chat_sessions WHERE id = $1', [sessionId]);
    if (!sRes.rows.length) return respond(res, 404, { error: 'Session not found' });
    const session = sRes.rows[0];

    const workdir = session.workdir || path.join(SESSIONS_ROOT, `company-${session.company_id}-session-${sessionId}`);
    fs.mkdirSync(workdir, { recursive: true });
    await writeContextFile(session.company_id, workdir);

    const isIntake = session.session_type === 'intake';

    const historyRes = await db.query(
      'SELECT role, content FROM kyc_chat_messages WHERE session_id = $1 ORDER BY id ASC',
      [sessionId]
    );
    const history = historyRes.rows;
    const historyBlock = history.length
      ? history.map((m) => `### ${m.role === 'user' ? 'Usuario' : 'Asistente'}\n${m.content}`).join('\n\n')
      : '_(sin mensajes previos — primera interacción)_';

    const researchPrompt = `Eres un asistente KYC para una empresa cliente. Estás en el workdir de una sesión de investigación. En CONTEXT.md tienes el perfil KYC actual (léelo primero con Read). Tu misión: enriquecer el conocimiento — organigrama formal/informal, stack tecnológico, datos económicos, modelo de negocio, clientes, procesos críticos, opiniones.

Herramientas disponibles: Read, Write, Bash, WebFetch, WebSearch. Usa WebSearch/WebFetch para investigar activamente. Cuando encuentres un dato nuevo concreto, escríbelo en PROPOSED_UPDATES.json en formato: {"field_path":"economics.revenue","value":...,"source":"url","confidence":0.8}.

Sé directo, en español, orientado a acción comercial. company_id=${session.company_id}.

## Historial de la conversación
${historyBlock}

## Nuevo mensaje del usuario
${userMessage}`;

    const intakePrompt = `Eres un asistente KYC que conduce una ENTREVISTA GUIADA para capturar el conocimiento de una empresa cliente. Mezclas investigación externa (WebSearch/WebFetch) con preguntas abiertas al usuario. Tienes MEMORIA: lee el historial de la conversación y CONTEXT.md antes de actuar.

HERRAMIENTAS: Read, Write, Bash, WebFetch, WebSearch.

═══════════════════════════════════════════════════
FASE 1 — INVESTIGACIÓN AUTÓNOMA (solo en la PRIMERA interacción)
═══════════════════════════════════════════════════
Si el historial está vacío o el primer mensaje es "/iniciar", "hola", etc:

1. Lee CONTEXT.md con Read.
2. Haz WebSearch y WebFetch agresivo sobre la empresa. Extrae todo lo posible:
   - Qué hace, propuesta de valor
   - Facturación, empleados, sedes, año de fundación
   - Sector, subsector, modelo de negocio
   - Noticias recientes (últimos 12 meses)
   - Tecnología mencionada públicamente
3. Escribe PROPOSED_UPDATES.json con un ARRAY que incluya AL MENOS:
   - {"field_path":"summary","value":"<resumen 2-3 frases>","source":"websearch","confidence":0.8}
   - {"field_path":"sector_context","value":{...},"source":"websearch","confidence":0.7}
   - {"field_path":"business_model","value":{...},"source":"websearch","confidence":0.7}
   - Si detectas tech: {"field_path":"tech_stack","value":{...},"source":"websearch","confidence":0.5}
4. Responde con un saludo, un bloque "📋 Lo que he encontrado públicamente" y la PREGUNTA ABIERTA de Fase 2.

═══════════════════════════════════════════════════
FASE 2 — ORGANIGRAMA
═══════════════════════════════════════════════════
Pregunta abierta sobre el organigrama. Extrae nombres y roles, persiste como org_member.
Para roles que no sepa, crea open_question con priority 1.

═══════════════════════════════════════════════════
FASE 3 — STACK TECNOLÓGICO (INCISIVO)
═══════════════════════════════════════════════════
Profundiza en cada sistema mencionado: ERP, CRM, cloud, BI, sectoriales. Persiste en tech_stack.
Para lo que no sepa, genera open_question.

═══════════════════════════════════════════════════
FASE 4 — CIERRE
═══════════════════════════════════════════════════
Resumen + ángulos comerciales + siguiente acción + lista de open questions.

REGLAS:
- SIEMPRE lee CONTEXT.md primero.
- Español directo.
- PROPOSED_UPDATES.json se reescribe en CADA turno — no acumules entre turnos.
- No expliques el protocolo al usuario.

company_id=${session.company_id}.

## Historial de la conversación
${historyBlock}

## Nuevo mensaje del usuario
${userMessage}`;

    const systemPrompt = isIntake ? intakePrompt : researchPrompt;

    const userMsgRow = await db.query(
      'INSERT INTO kyc_chat_messages (session_id, role, content) VALUES ($1, $2, $3) RETURNING id',
      [sessionId, 'user', userMessage]
    );
    const userMsgId = userMsgRow.rows[0].id;

    sseInit(res);
    sseSend(res, 'start', { session_id: sessionId, user_message_id: userMsgId });

    let fullText = '';
    const child = runClaudeStream({
      workdir,
      prompt: systemPrompt,
      apiKey,
      onText: (t) => {
        if (!t) return;
        fullText += t;
        sseSend(res, 'chunk', { text: t });
      },
      onError: (err) => {
        sseSend(res, 'error', { error: err });
        res.end();
      },
      onDone: async (code) => {
        let applied = 0;
        try {
          const r = await applyProposedUpdates(session.company_id, workdir);
          applied = r.applied || 0;
        } catch (e) { console.error('[applyProposedUpdates]', e.message); }
        await db.query(
          'INSERT INTO kyc_chat_messages (session_id, role, content, meta) VALUES ($1, $2, $3, $4)',
          [sessionId, 'assistant', fullText, JSON.stringify({ exit_code: code, updates_applied: applied })]
        );
        await db.query('UPDATE kyc_chat_sessions SET updated_at = now() WHERE id = $1', [sessionId]);
        sseSend(res, 'done', { exit_code: code, updates_applied: applied });
        res.end();
      },
    });

    req.on('close', () => {
      try { child.kill('SIGTERM'); } catch {}
    });
    return true;
  }

  return false;
}

module.exports = { handle };
