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
  getSubmissionById,
  insertSubmission,
  listSubmissionSummaries,
  storageKind,
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

  app.get('/api/bootstrap', (req, res) => {
    const token = req.query.token || req.get('x-intake-token');
    if (!timingSafeEqualString(token, INTAKE_TOKEN)) {
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

  app.post('/api/submit', async (req, res) => {
    const token = req.body?.intakeToken || req.get('x-intake-token');
    if (!timingSafeEqualString(token, INTAKE_TOKEN)) {
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
    try {
      const saved = await insertSubmission({
        id,
        artistName: result.artistName,
        sectionData: req.body.sections,
        submittedAt,
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

  app.get('/api/taig/submissions', requireTaigToken, async (_req, res) => {
    const submissions = await listSubmissionSummaries();
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
        `attachment; filename="jay-epk-submission-${submission.id}.json"`
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
    const summaries = await listSubmissionSummaries();
    const selectedId = req.query.id || (summaries[0] && summaries[0].id);
    const selected = selectedId ? await getSubmissionById(selectedId) : null;

    const listHtml = summaries.length
      ? summaries
          .map(
            (s) =>
              `<li><a href="/taig/review?token=${encodeURIComponent(token)}&id=${encodeURIComponent(s.id)}">${escapeHtml(s.id)}</a> — ${escapeHtml(s.submittedAt)} — ${escapeHtml(s.status)}</li>`
          )
          .join('')
      : '<li>No submissions yet.</li>';

    let detailHtml = '<p>Select a submission.</p>';
    if (selected) {
      detailHtml = `
        <p><strong>ID:</strong> ${escapeHtml(selected.id)}<br>
        <strong>Submitted:</strong> ${escapeHtml(selected.submittedAt)}<br>
        <strong>Status:</strong> ${escapeHtml(selected.status)} (not validated)<br>
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
  </style>
</head>
<body>
<main>
  <h1>Intake submissions</h1>
  <p>Review only. Submissions stay as submitted until TAIG validates them separately.</p>
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

  app.get('/', (_req, res) => {
    res
      .status(404)
      .type('html')
      .send('<!doctype html><title>Not found</title><p>Not found</p>');
  });

  return app;
}
