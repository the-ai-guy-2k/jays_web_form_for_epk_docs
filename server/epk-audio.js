import fs from 'node:fs';
import path from 'node:path';
import { ROOT_DIR } from './config.js';

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

export function handleEpkDownload(req, res) {
  const track = resolveApprovedTrack(req.params.trackId);
  if (!track) {
    return res.status(404).json({
      error: 'That track is not available for download.',
    });
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

  res.set({
    'Content-Type': track.mime,
    'Content-Length': String(stat.size),
    'Content-Disposition': `attachment; filename="${track.downloadName}"`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private',
  });
  return res.sendFile(filePath);
}
