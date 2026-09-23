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
    form_version TEXT NOT NULL,
    artist_name TEXT NOT NULL,
    status TEXT NOT NULL,
    section_data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    submitted_at TEXT NOT NULL
  );
`;

function mapRow(row) {
  return {
    id: row.id,
    formVersion: row.form_version,
    artistName: row.artist_name,
    status: row.status,
    sectionData:
      typeof row.section_data === 'string'
        ? JSON.parse(row.section_data)
        : row.section_data,
    createdAt: row.created_at,
    submittedAt: row.submitted_at,
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
  await pgPool.query(`
    CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at
      ON submissions(submitted_at);
  `);
}

function initSqlite() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  sqlite = new DatabaseSync(DATABASE_PATH);
  sqlite.exec(`
    ${CREATE_SQL}
    CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at
      ON submissions(submitted_at);
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

/** @deprecated sync accessor for sqlite-only local scripts — prefer initStore */
export function getDb() {
  if (USE_POSTGRES) {
    throw new Error('getDb() is SQLite-only. Use async store helpers with DATABASE_URL.');
  }
  if (!sqlite) initSqlite();
  return sqlite;
}

export async function insertSubmission({ id, artistName, sectionData, submittedAt }) {
  await initStore();
  const payload = JSON.stringify(sectionData);
  if (USE_POSTGRES) {
    await pgPool.query(
      `INSERT INTO submissions
        (id, form_version, artist_name, status, section_data, created_at, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, FORM_VERSION, artistName, 'submitted', payload, submittedAt, submittedAt]
    );
  } else {
    getDb()
      .prepare(
        `INSERT INTO submissions
          (id, form_version, artist_name, status, section_data, created_at, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        FORM_VERSION,
        artistName,
        'submitted',
        payload,
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

export async function listSubmissionSummaries() {
  await initStore();
  if (USE_POSTGRES) {
    const result = await pgPool.query(
      `SELECT id, form_version, artist_name, status, created_at, submitted_at
       FROM submissions
       ORDER BY submitted_at DESC`
    );
    return result.rows.map((row) => ({
      id: row.id,
      formVersion: row.form_version,
      artistName: row.artist_name,
      status: row.status,
      createdAt: row.created_at,
      submittedAt: row.submitted_at,
    }));
  }
  const rows = getDb()
    .prepare(
      `SELECT id, form_version, artist_name, status, created_at, submitted_at
       FROM submissions
       ORDER BY submitted_at DESC`
    )
    .all();
  return rows.map((row) => ({
    id: row.id,
    formVersion: row.form_version,
    artistName: row.artist_name,
    status: row.status,
    createdAt: row.created_at,
    submittedAt: row.submitted_at,
  }));
}

export function storageKind() {
  return USE_POSTGRES ? 'postgres' : 'sqlite';
}

export function dbPath() {
  return USE_POSTGRES ? 'DATABASE_URL' : path.resolve(DATABASE_PATH);
}
