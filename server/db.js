import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  DATABASE_PATH,
  DATA_DIR,
  FORM_VERSION,
  USE_POSTGRES,
  DATABASE_URL,
} from './config.js';

let sqlite;
let pgPool;
let ready;

const CREATE_SQL = `
  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    resume_token TEXT UNIQUE,
    form_version TEXT NOT NULL,
    artist_name TEXT NOT NULL,
    status TEXT NOT NULL,
    section_data TEXT NOT NULL,
    current_step INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    submitted_at TEXT
  );
`;

function mapRow(row) {
  return {
    id: row.id,
    resumeToken: row.resume_token || null,
    formVersion: row.form_version,
    artistName: row.artist_name,
    status: row.status,
    sectionData:
      typeof row.section_data === 'string'
        ? JSON.parse(row.section_data)
        : row.section_data,
    currentStep: Number(row.current_step || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at || null,
  };
}

async function initPostgres() {
  const { default: pg } = await import('pg');
  pgPool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl:
      process.env.PGSSLMODE === 'disable'
        ? false
        : { rejectUnauthorized: false },
  });
  await pgPool.query(CREATE_SQL);
  await migratePostgres();
  await pgPool.query(`
    CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at
      ON submissions(submitted_at);
    CREATE INDEX IF NOT EXISTS idx_submissions_status
      ON submissions(status);
  `);
}

async function migratePostgres() {
  const alters = [
    'ALTER TABLE submissions ADD COLUMN IF NOT EXISTS resume_token TEXT',
    'ALTER TABLE submissions ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 0',
    'ALTER TABLE submissions ADD COLUMN IF NOT EXISTS updated_at TEXT',
  ];
  for (const sql of alters) {
    try {
      await pgPool.query(sql);
    } catch {
      /* older PG without IF NOT EXISTS — ignore */
    }
  }
}

function initSqlite() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  sqlite = new DatabaseSync(DATABASE_PATH);
  sqlite.exec(CREATE_SQL);
  migrateSqlite();
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at
      ON submissions(submitted_at);
    CREATE INDEX IF NOT EXISTS idx_submissions_status
      ON submissions(status);
  `);
}

function migrateSqlite() {
  const cols = sqlite
    .prepare(`PRAGMA table_info(submissions)`)
    .all()
    .map((c) => c.name);
  const master = sqlite
    .prepare(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name='submissions'`
    )
    .get();
  const needsRebuild =
    !cols.includes('resume_token') ||
    !cols.includes('updated_at') ||
    (master?.sql || '').includes('submitted_at TEXT NOT NULL');

  if (!needsRebuild) return;

  sqlite.exec(`
    ALTER TABLE submissions RENAME TO submissions_legacy;
    ${CREATE_SQL}
    INSERT INTO submissions
      (id, resume_token, form_version, artist_name, status, section_data,
       current_step, created_at, updated_at, submitted_at)
    SELECT
      id,
      NULL,
      form_version,
      artist_name,
      CASE WHEN status IS NULL OR status = '' THEN 'submitted' ELSE status END,
      section_data,
      0,
      created_at,
      COALESCE(submitted_at, created_at),
      submitted_at
    FROM submissions_legacy;
    DROP TABLE submissions_legacy;
  `);
}

export async function initStore() {
  if (ready) return ready;
  ready = (async () => {
    if (USE_POSTGRES) {
      await initPostgres();
      console.log('[store] Using Postgres (DATABASE_URL)');
    } else {
      initSqlite();
      console.log(`[store] Using SQLite: ${path.resolve(DATABASE_PATH)}`);
    }
  })();
  return ready;
}

export function getDb() {
  if (USE_POSTGRES) {
    throw new Error('getDb() is SQLite-only. Use async store helpers with DATABASE_URL.');
  }
  if (!sqlite) initSqlite();
  return sqlite;
}

function artistFromSections(sectionData) {
  return (
    (sectionData?.artist?.artistName &&
      String(sectionData.artist.artistName).trim()) ||
    'Jay Garrett'
  );
}

export async function upsertDraft({
  id,
  resumeToken,
  sectionData,
  currentStep = 0,
}) {
  await initStore();
  const now = new Date().toISOString();
  const payload = JSON.stringify(sectionData);
  const artistName = artistFromSections(sectionData);

  if (USE_POSTGRES) {
    if (resumeToken) {
      const existing = await pgPool.query(
        `SELECT id, status FROM submissions WHERE resume_token = $1`,
        [resumeToken]
      );
      if (existing.rows[0]) {
        if (existing.rows[0].status !== 'draft') {
          const err = new Error('This draft was already submitted.');
          err.code = 'ALREADY_SUBMITTED';
          throw err;
        }
        await pgPool.query(
          `UPDATE submissions
           SET section_data = $1, current_step = $2, artist_name = $3,
               updated_at = $4, form_version = $5
           WHERE resume_token = $6 AND status = 'draft'`,
          [payload, currentStep, artistName, now, FORM_VERSION, resumeToken]
        );
        return getByResumeToken(resumeToken);
      }
    }
    await pgPool.query(
      `INSERT INTO submissions
        (id, resume_token, form_version, artist_name, status, section_data,
         current_step, created_at, updated_at, submitted_at)
       VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $7, NULL)`,
      [id, resumeToken, FORM_VERSION, artistName, payload, currentStep, now]
    );
    return getByResumeToken(resumeToken);
  }

  if (resumeToken) {
    const existing = getDb()
      .prepare(`SELECT id, status FROM submissions WHERE resume_token = ?`)
      .get(resumeToken);
    if (existing) {
      if (existing.status !== 'draft') {
        const err = new Error('This draft was already submitted.');
        err.code = 'ALREADY_SUBMITTED';
        throw err;
      }
      getDb()
        .prepare(
          `UPDATE submissions
           SET section_data = ?, current_step = ?, artist_name = ?,
               updated_at = ?, form_version = ?
           WHERE resume_token = ? AND status = 'draft'`
        )
        .run(payload, currentStep, artistName, now, FORM_VERSION, resumeToken);
      return getByResumeToken(resumeToken);
    }
  }

  getDb()
    .prepare(
      `INSERT INTO submissions
        (id, resume_token, form_version, artist_name, status, section_data,
         current_step, created_at, updated_at, submitted_at)
       VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, NULL)`
    )
    .run(
      id,
      resumeToken,
      FORM_VERSION,
      artistName,
      payload,
      currentStep,
      now,
      now
    );
  return getByResumeToken(resumeToken);
}

export async function getByResumeToken(resumeToken) {
  await initStore();
  if (USE_POSTGRES) {
    const result = await pgPool.query(
      'SELECT * FROM submissions WHERE resume_token = $1',
      [resumeToken]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }
  const row = getDb()
    .prepare('SELECT * FROM submissions WHERE resume_token = ?')
    .get(resumeToken);
  return row ? mapRow(row) : null;
}

export async function insertSubmission({
  id,
  artistName,
  sectionData,
  submittedAt,
  resumeToken = null,
}) {
  await initStore();
  const payload = JSON.stringify(sectionData);

  if (resumeToken) {
    const draft = await getByResumeToken(resumeToken);
    if (draft && draft.status === 'draft') {
      if (USE_POSTGRES) {
        await pgPool.query(
          `UPDATE submissions
           SET status = 'submitted', section_data = $1, artist_name = $2,
               updated_at = $3, submitted_at = $3, form_version = $4,
               current_step = $5
           WHERE resume_token = $6 AND status = 'draft'`,
          [
            payload,
            artistName,
            submittedAt,
            FORM_VERSION,
            10,
            resumeToken,
          ]
        );
      } else {
        getDb()
          .prepare(
            `UPDATE submissions
             SET status = 'submitted', section_data = ?, artist_name = ?,
                 updated_at = ?, submitted_at = ?, form_version = ?,
                 current_step = ?
             WHERE resume_token = ? AND status = 'draft'`
          )
          .run(
            payload,
            artistName,
            submittedAt,
            submittedAt,
            FORM_VERSION,
            10,
            resumeToken
          );
      }
      return getByResumeToken(resumeToken);
    }
  }

  if (USE_POSTGRES) {
    await pgPool.query(
      `INSERT INTO submissions
        (id, resume_token, form_version, artist_name, status, section_data,
         current_step, created_at, updated_at, submitted_at)
       VALUES ($1, $2, $3, $4, 'submitted', $5, 10, $6, $6, $6)`,
      [id, resumeToken, FORM_VERSION, artistName, payload, submittedAt]
    );
  } else {
    getDb()
      .prepare(
        `INSERT INTO submissions
          (id, resume_token, form_version, artist_name, status, section_data,
           current_step, created_at, updated_at, submitted_at)
         VALUES (?, ?, ?, ?, 'submitted', ?, 10, ?, ?, ?)`
      )
      .run(
        id,
        resumeToken,
        FORM_VERSION,
        artistName,
        payload,
        submittedAt,
        submittedAt,
        submittedAt
      );
  }
  return getSubmissionById(id);
}

export async function getSubmissionById(id) {
  await initStore();
  if (USE_POSTGRES) {
    const result = await pgPool.query(
      'SELECT * FROM submissions WHERE id = $1',
      [id]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }
  const row = getDb()
    .prepare('SELECT * FROM submissions WHERE id = ?')
    .get(id);
  return row ? mapRow(row) : null;
}

export async function listSubmissionSummaries({ status } = {}) {
  await initStore();
  if (USE_POSTGRES) {
    const result = status
      ? await pgPool.query(
          `SELECT id, resume_token, form_version, artist_name, status,
                  created_at, updated_at, submitted_at
           FROM submissions WHERE status = $1
           ORDER BY COALESCE(submitted_at, updated_at) DESC`,
          [status]
        )
      : await pgPool.query(
          `SELECT id, resume_token, form_version, artist_name, status,
                  created_at, updated_at, submitted_at
           FROM submissions
           ORDER BY COALESCE(submitted_at, updated_at) DESC`
        );
    return result.rows.map(summarize);
  }

  const rows = status
    ? getDb()
        .prepare(
          `SELECT id, resume_token, form_version, artist_name, status,
                  created_at, updated_at, submitted_at
           FROM submissions WHERE status = ?
           ORDER BY COALESCE(submitted_at, updated_at) DESC`
        )
        .all(status)
    : getDb()
        .prepare(
          `SELECT id, resume_token, form_version, artist_name, status,
                  created_at, updated_at, submitted_at
           FROM submissions
           ORDER BY COALESCE(submitted_at, updated_at) DESC`
        )
        .all();
  return rows.map(summarize);
}

function summarize(row) {
  return {
    id: row.id,
    resumeToken: row.resume_token || null,
    formVersion: row.form_version,
    artistName: row.artist_name,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at || null,
  };
}

export function storageKind() {
  return USE_POSTGRES ? 'postgres' : 'sqlite';
}

export function dbPath() {
  return USE_POSTGRES ? 'DATABASE_URL' : path.resolve(DATABASE_PATH);
}
