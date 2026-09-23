import crypto from 'node:crypto';
import express from 'express';
import path from 'node:path';
import {
  FORM_VERSION,
  INTAKE_TOKEN,
  PUBLIC_DIR,
  TAIG_REVIEW_TOKEN,
} from './config.js';
import {
  getByResumeToken,
  getSubmissionById,
  insertSubmission,
  listSubmissionSummaries,
  storageKind,
  upsertDraft,
} from './db.js';
import { validateSubmission } from './validation.js';

function timingSafeEqualString(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function requireTaigToken(req, res, next) {
  const token =
    req.query.token ||
    req.get('x-taig-token') ||
    (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!timingSafeEqualString(token, TAIG_REVIEW_TOKEN)) {
    return res.status(401).json({
      error: 'Unauthorized. A valid review token is required.',
    });
  }
  return next();
}

function requireIntakeToken(req) {
  const token =
    req.body?.intakeToken ||
    req.query.token ||
    req.get('x-intake-token');
  return timingSafeEqualString(token, INTAKE_TOKEN);
}

function makeResumeToken() {
  return crypto.randomBytes(24).toString('base64url');
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      formVersion: FORM_VERSION,
      storage: storageKind(),
    });
  });

  // Operator-facing splash (no form; no secrets)
  app.get('/', (_req, res) => {
    res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Jay Garrett — EPK Intake</title>
  <link rel="stylesheet" href="/css/styles.css" />
</head>
<body>
  <div class="splash">
    <div class="splash-inner">
      <p class="brand">JAY GARRETT</p>
      <h1>Electronic Press Kit Information</h1>
      <p>This intake is private. Open the secure link provided by TAIG Promotions to continue.</p>
    </div>
  </div>
</body>
</html>`);
  });

  app.get('/api/bootstrap', (req, res) => {
    if (!requireIntakeToken(req)) {
      return res.status(401).json({ error: 'Invalid intake link.' });
    }
    return res.json({
      formVersion: FORM_VERSION,
      known: {
        artistName: 'Jay Garrett',
        genre: 'Country',
        trackCount: 12,
        albumMastersNote: 'Reported complete and locked',
        releaseDate: '2026-10-19',
        producerContext:
          "Scott is the known producer contact. Exact public producer credit still requires confirmation.",
        featuredSong1: 'Karma Catching Up',
        featuredSong2: 'Something You Can Stomp To',
        distributionNote:
          'Submitted. Final public streaming/platform links still require verification.',
        artworkNote:
          'TAIG already has album artwork. Only provide a newer/final/high-resolution version if one exists.',
        management: 'TAIG Promotions',
      },
    });
  });

  // Save draft progress (not a final submission)
  app.post('/api/draft', async (req, res) => {
    if (!requireIntakeToken(req)) {
      return res.status(401).json({ error: 'Invalid intake link.' });
    }
    const sections = req.body?.sections;
    if (!sections || typeof sections !== 'object') {
      return res.status(400).json({ error: 'Nothing to save yet.' });
    }
    const currentStep = Number(req.body?.currentStep || 0);
    let resumeToken = String(req.body?.resumeToken || '').trim() || null;

    try {
      if (!resumeToken) resumeToken = makeResumeToken();
      const id = crypto.randomUUID();
      const saved = await upsertDraft({
        id,
        resumeToken,
        sectionData: sections,
        currentStep,
      });
      const resumePath = `/i/${INTAKE_TOKEN}?draft=${encodeURIComponent(saved.resumeToken)}`;
      return res.status(200).json({
        ok: true,
        status: 'draft',
        resumeToken: saved.resumeToken,
        updatedAt: saved.updatedAt,
        currentStep: saved.currentStep,
        resumePath,
        message:
          'Progress saved. Keep your resume link so you can come back and finish later. This is not your final submission.',
      });
    } catch (err) {
      if (err.code === 'ALREADY_SUBMITTED') {
        return res.status(409).json({
          error: 'This draft was already submitted and can no longer be edited.',
        });
      }
      console.error('[draft] save failure');
      return res.status(500).json({
        error: 'Could not save progress right now. Please try again.',
      });
    }
  });

  app.get('/api/draft/:resumeToken', async (req, res) => {
    if (!requireIntakeToken(req)) {
      return res.status(401).json({ error: 'Invalid intake link.' });
    }
    const draft = await getByResumeToken(req.params.resumeToken);
    if (!draft) {
      return res.status(404).json({ error: 'Saved progress not found.' });
    }
    if (draft.status !== 'draft') {
      return res.status(409).json({
        error: 'This intake was already submitted.',
        status: draft.status,
        submissionId: draft.id,
      });
    }
    return res.json({
      status: draft.status,
      resumeToken: draft.resumeToken,
      currentStep: draft.currentStep,
      updatedAt: draft.updatedAt,
      sections: draft.sectionData,
    });
  });

  app.post('/api/submit', async (req, res) => {
    if (!requireIntakeToken(req)) {
      return res.status(401).json({ error: 'Invalid intake link.' });
    }

    const result = validateSubmission(req.body);
    if (!result.ok) {
      return res.status(400).json({
        error: 'Please fix the highlighted items and try again.',
        errors: result.errors,
        fieldErrors: result.fieldErrors,
      });
    }

    const submittedAt = new Date().toISOString();
    const id = crypto.randomUUID();
    const resumeToken = String(req.body?.resumeToken || '').trim() || null;
    try {
      const saved = await insertSubmission({
        id,
        artistName: result.artistName,
        sectionData: req.body.sections,
        submittedAt,
        resumeToken,
      });
      return res.status(201).json({
        ok: true,
        submissionId: saved.id,
        status: saved.status,
        submittedAt: saved.submittedAt,
        formVersion: saved.formVersion,
        message:
          'Thank you. TAIG Promotions has received your Electronic Press Kit information and will review it before it is used publicly.',
      });
    } catch (err) {
      console.error('[submit] storage failure');
      return res.status(500).json({
        error:
          'We could not save your answers right now. Please try again in a moment. Nothing was published.',
      });
    }
  });

  app.get('/api/taig/submissions', requireTaigToken, async (req, res) => {
    const status = req.query.status || undefined;
    const submissions = await listSubmissionSummaries(
      status ? { status } : {}
    );
    return res.json({
      formVersion: FORM_VERSION,
      submissions,
    });
  });

  app.get('/api/taig/submissions/:id', requireTaigToken, async (req, res) => {
    const submission = await getSubmissionById(req.params.id);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found.' });
    }
    return res.json(submission);
  });

  app.get(
    '/api/taig/submissions/:id/export.json',
    requireTaigToken,
    async (req, res) => {
      const submission = await getSubmissionById(req.params.id);
      if (!submission) {
        return res.status(404).json({ error: 'Submission not found.' });
      }
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="jay-epk-${submission.status}-${submission.id}.json"`
      );
      return res.json(submission);
    }
  );

  app.get('/taig/review', async (req, res) => {
    const token = req.query.token || '';
    if (!timingSafeEqualString(token, TAIG_REVIEW_TOKEN)) {
      return res
        .status(401)
        .type('html')
        .send(
          '<!doctype html><html><body style="font-family:system-ui;padding:2rem"><h1>Unauthorized</h1><p>A valid review token is required.</p></body></html>'
        );
    }
    const filter = req.query.status || '';
    const summaries = await listSubmissionSummaries(
      filter ? { status: filter } : {}
    );
    const selectedId = req.query.id || (summaries[0] && summaries[0].id);
    const selected = selectedId ? await getSubmissionById(selectedId) : null;

    const listHtml = summaries.length
      ? summaries
          .map(
            (s) =>
              `<li><a href="/taig/review?token=${encodeURIComponent(token)}&id=${encodeURIComponent(s.id)}">${escapeHtml(s.id)}</a> — <strong>${escapeHtml(s.status)}</strong> — ${escapeHtml(s.submittedAt || s.updatedAt || '')}</li>`
          )
          .join('')
      : '<li>No records yet.</li>';

    let detailHtml = '<p>Select a record.</p>';
    if (selected) {
      detailHtml = `
        <p><strong>ID:</strong> ${escapeHtml(selected.id)}<br>
        <strong>Status:</strong> ${escapeHtml(selected.status)}${selected.status === 'submitted' ? ' (not validated)' : ' (in progress — not final)'}<br>
        <strong>Updated:</strong> ${escapeHtml(selected.updatedAt || '')}<br>
        <strong>Submitted:</strong> ${escapeHtml(selected.submittedAt || '—')}<br>
        <strong>Form version:</strong> ${escapeHtml(selected.formVersion)}<br>
        <strong>Artist:</strong> ${escapeHtml(selected.artistName)}</p>
        <p><a href="/api/taig/submissions/${encodeURIComponent(selected.id)}/export.json?token=${encodeURIComponent(token)}">Download JSON export</a></p>
        <pre style="white-space:pre-wrap;background:#f4f4f1;padding:1rem;border-radius:8px;overflow:auto">${escapeHtml(JSON.stringify(selected.sectionData, null, 2))}</pre>
      `;
    }

    return res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>EPK Intake Review</title>
  <style>
    body{font-family:Georgia,"Times New Roman",serif;margin:0;background:#f7f5f0;color:#1c1b19}
    main{max-width:920px;margin:0 auto;padding:1.25rem}
    h1{font-size:1.5rem;margin:0 0 .5rem}
    ul{padding-left:1.2rem}
    a{color:#1a4d2e}
    .filters a{margin-right:1rem}
  </style>
</head>
<body>
<main>
  <h1>Intake records</h1>
  <p class="filters">
    <a href="/taig/review?token=${encodeURIComponent(token)}">All</a>
    <a href="/taig/review?token=${encodeURIComponent(token)}&status=submitted">Submitted only</a>
    <a href="/taig/review?token=${encodeURIComponent(token)}&status=draft">Drafts only</a>
  </p>
  <ul>${listHtml}</ul>
  <hr />
  ${detailHtml}
</main>
</body>
</html>`);
  });

  app.get(`/i/:token`, (req, res) => {
    if (!timingSafeEqualString(req.params.token, INTAKE_TOKEN)) {
      return res
        .status(404)
        .type('html')
        .send('<!doctype html><title>Not found</title><p>Not found</p>');
    }
    return res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });

  app.use(express.static(PUBLIC_DIR, { index: false }));

  return app;
}
