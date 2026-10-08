import fs from 'node:fs';
import path from 'node:path';
import { EPK_DOWNLOAD_PASSWORD, ROOT_DIR } from './config.js';
import { timingSafeEqualString } from './timing-safe.js';

const MASTER_DIR = path.join(ROOT_DIR, 'media', 'masters');

/** Approved public track IDs only. Client cannot choose a filesystem path. */
export const FEATURED_DOWNLOADS = Object.freeze({
  'karma-catching-up': {
    id: 'karma-catching-up',
    title: 'Karma Catching Up',
    masterFile: '03Karma Catching Up MSTR 24bit_48hz.wav',
    downloadName: 'Jay-Garrett-Karma-Catching-Up.wav',
    mime: 'audio/wav',
    expectedBytes: 77377074,
  },
  'something-we-can-stomp-to': {
    id: 'something-we-can-stomp-to',
    title: 'Something We Can Stomp To',
    masterFile: '01Stomp to MIX MSTR 24bit_48hz.wav',
    downloadName: 'Jay-Garrett-Something-We-Can-Stomp-To.wav',
    mime: 'audio/wav',
    expectedBytes: 59968382,
  },
});

const FAIL_WINDOW_MS = 15 * 60 * 1000;
const FAIL_LIMIT = 5;
const BACKOFF_MS = 60 * 1000;
const attempts = new Map();

function clientKey(req) {
  return String(req.socket?.remoteAddress || 'unknown');
}

function pruneAttempts(now) {
  for (const [key, rec] of attempts) {
    if (now - rec.firstFailAt > FAIL_WINDOW_MS && now >= rec.blockedUntil) {
      attempts.delete(key);
    }
  }
}

export function resetDownloadThrottle() {
  attempts.clear();
}

export function downloadThrottleState(req) {
  pruneAttempts(Date.now());
  const rec = attempts.get(clientKey(req));
  if (rec && Date.now() < rec.blockedUntil) {
    return { blocked: true, retryAfterSec: Math.ceil((rec.blockedUntil - Date.now()) / 1000) };
  }
  return { blocked: false };
}

function recordFailure(req) {
  const now = Date.now();
  const key = clientKey(req);
  const rec = attempts.get(key) || { fails: 0, firstFailAt: now, blockedUntil: 0 };
  if (now - rec.firstFailAt > FAIL_WINDOW_MS) {
    rec.fails = 0;
    rec.firstFailAt = now;
  }
  rec.fails += 1;
  if (rec.fails >= FAIL_LIMIT) {
    rec.blockedUntil = now + BACKOFF_MS * Math.min(rec.fails - FAIL_LIMIT + 1, 5);
  }
  attempts.set(key, rec);
}

function recordSuccess(req) {
  attempts.delete(clientKey(req));
}

export function resolveApprovedTrack(trackId) {
  const id = String(trackId || '');
  if (!Object.hasOwn(FEATURED_DOWNLOADS, id)) return null;
  return FEATURED_DOWNLOADS[id];
}

export function masterPathFor(track) {
  const abs = path.resolve(MASTER_DIR, track.masterFile);
  const root = path.resolve(MASTER_DIR) + path.sep;
  if (!abs.startsWith(root) || path.basename(abs) !== track.masterFile) return null;
  return abs;
}

export async function handleEpkDownload(req, res) {
  const throttle = downloadThrottleState(req);
  if (throttle.blocked) {
    res.set('Retry-After', String(throttle.retryAfterSec));
    return res.status(429).json({
      error: 'Too many attempts. Please wait a moment and try again.',
    });
  }

  const track = resolveApprovedTrack(req.body?.trackId);
  if (!track) {
    return res.status(400).json({
      error: 'That track is not available for download.',
    });
  }

  const supplied = String(req.body?.password ?? '');
  if (
    !EPK_DOWNLOAD_PASSWORD ||
    !timingSafeEqualString(supplied, EPK_DOWNLOAD_PASSWORD)
  ) {
    recordFailure(req);
    return res.status(401).json({ error: 'Incorrect download password.' });
  }

  const filePath = masterPathFor(track);
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(503).json({
      error: 'This download is temporarily unavailable.',
    });
  }

  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    return res.status(503).json({
      error: 'This download is temporarily unavailable.',
    });
  }

  recordSuccess(req);
  res.set({
    'Content-Type': track.mime,
    'Content-Length': String(stat.size),
    'Content-Disposition': `attachment; filename="${track.downloadName}"`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  });
  return res.sendFile(filePath);
}
