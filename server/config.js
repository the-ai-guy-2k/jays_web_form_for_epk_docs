import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function loadEnvFile() {
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile();

export const FORM_VERSION = 'epk-intake-v1';
export const PORT = Number(process.env.PORT || 3000);
export const TAIG_REVIEW_TOKEN = process.env.TAIG_REVIEW_TOKEN || '';
export const ROOT_DIR = rootDir;
export const PUBLIC_DIR = path.join(rootDir, 'public');
export const DATA_DIR = path.join(rootDir, 'data');
export const DATABASE_PATH =
  process.env.DATABASE_PATH || path.join(DATA_DIR, 'submissions.sqlite');
/** When set (e.g. Replit Postgres), use Postgres instead of SQLite. */
export const DATABASE_URL = process.env.DATABASE_URL || '';
export const USE_POSTGRES = Boolean(DATABASE_URL);

export function assertConfig() {
  const missing = [];
  if (!TAIG_REVIEW_TOKEN || TAIG_REVIEW_TOKEN.includes('change-me')) {
    missing.push('TAIG_REVIEW_TOKEN');
  }
  if (missing.length) {
    console.warn(
      `[config] Warning: set strong values for ${missing.join(', ')} before any live use.`
    );
  }
}
