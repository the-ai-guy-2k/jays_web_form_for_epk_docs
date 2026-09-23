import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DATABASE_PATH, DATA_DIR, FORM_VERSION } from './config.js';

let db;

export function getDb() {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(DATABASE_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      form_version TEXT NOT NULL,
      artist_name TEXT NOT NULL,
      status TEXT NOT NULL,
      section_data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      submitted_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at
      ON submissions(submitted_at);
  `);
  return db;
}

export function insertSubmission({ id, artistName, sectionData, submittedAt }) {
  const database = getDb();
  database
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
      JSON.stringify(sectionData),
      submittedAt,
      submittedAt
    );
  return getSubmissionById(id);
}

export function getSubmissionById(id) {
  const row = getDb()
    .prepare('SELECT * FROM submissions WHERE id = ?')
    .get(id);
  return row ? mapRow(row) : null;
}

export function listSubmissionSummaries() {
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

function mapRow(row) {
  return {
    id: row.id,
    formVersion: row.form_version,
    artistName: row.artist_name,
    status: row.status,
    sectionData: JSON.parse(row.section_data),
    createdAt: row.created_at,
    submittedAt: row.submitted_at,
  };
}

export function dbPath() {
  return path.resolve(DATABASE_PATH);
}
