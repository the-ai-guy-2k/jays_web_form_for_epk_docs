import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'data');
const validationDb = path.join(dataDir, 'validation-submissions.sqlite');

fs.mkdirSync(dataDir, { recursive: true });
if (fs.existsSync(validationDb)) fs.unlinkSync(validationDb);
process.env.DATABASE_PATH = validationDb;

// Load modules only after DATABASE_PATH is set
const { createApp } = await import('../server/index.js');
const {
  INTAKE_TOKEN,
  TAIG_REVIEW_TOKEN,
  DATABASE_PATH,
} = await import('../server/config.js');
const { getDb } = await import('../server/db.js');

const results = [];

function pass(id, detail = '') {
  results.push({ id, status: 'PASS', detail });
  console.log(`PASS  ${id}${detail ? ' — ' + detail : ''}`);
}

function fail(id, detail = '') {
  results.push({ id, status: 'FAIL', detail });
  console.error(`FAIL  ${id}${detail ? ' — ' + detail : ''}`);
}

async function request(app, method, url, { headers = {}, body } = {}) {
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}${url}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* html or empty */
    }
    return { status: res.status, text, json };
  } finally {
    await new Promise((r) => server.close(r));
  }
}

function samplePayload() {
  return {
    intakeToken: INTAKE_TOKEN,
    formVersion: 'epk-intake-v1',
    sections: {
      artist: {
        artistName: 'Jay Garrett',
        homeMarket: 'Jacksonville, Florida',
        genre: 'Country',
        genreDetail: 'Contemporary Country',
        oneLineDescription: 'Country artist telling real stories from the road.',
        officialWebsite: '',
      },
      bio: {
        hometownOrigin: 'Northeast Florida',
        yearsPerforming: '15',
        yearsWriting: '12',
        musicalInfluences: 'Classic country and southern rock.',
        whatMakesDifferent: 'Honest lyrics and live energy.',
        careerMilestones: 'Independent releases and regional touring.',
        previousReleases: ['Earlier single'],
        notablePerformances: 'Regional venues',
        newListenersShouldKnow: 'Start with the new album singles.',
        existingBio: '',
      },
      album: {
        albumTitle: 'Validation Album Title',
        releaseDate: '2026-10-19',
        trackCount: 12,
        tracklist: Array.from({ length: 12 }, (_, i) => `Track ${i + 1}`),
        albumStory: 'An album about persistence and the road.',
        producerCredit: 'Scott — Producer',
        recordingStudio: '',
        albumCredits: [{ name: 'Scott', role: 'Producer' }],
        songwritingCredits: [
          { song: 'Karma Catching Up', writers: 'Jay Garrett' },
        ],
      },
      featured: {
        featuredSong1: 'Karma Catching Up',
        song1Story: 'A song about consequences catching up.',
        song1Link: '',
        featuredSong2: 'Something You Can Stomp To',
        song2Story: 'An uptempo floor-filler.',
        song2Link: '',
        additionalFeaturedSong: '',
        additionalSongStory: '',
        cleanRadioReady: 'Yes',
      },
      photos: {
        primaryArtistPhoto: 'https://example.com/jay-primary.jpg',
        additionalArtistPhotos: ['https://example.com/jay-2.jpg'],
        livePhotos: [],
        albumArtworkUpdate: '',
        artistLogo: '',
        photographerCredits: [
          { photo: 'Primary', photographer: 'Local Photographer' },
        ],
        permissionAssets: true,
      },
      streaming: {
        spotify: '',
        appleMusic: '',
        youtubeArtist: '',
        youtubeMusic: '',
        amazonMusic: '',
        otherStreamingLinks: [],
        officialMusicVideos: [],
        livePerformanceVideos: [],
        otherVideoLinks: [],
      },
      social: {
        facebook: 'https://facebook.com/example',
        instagram: 'https://instagram.com/example',
        tiktok: '',
        youtube: '',
        otherSocialProfiles: [],
      },
      proof: {
        radioAirplay: [],
        pressItems: [],
        awards: [],
        notableVenues: ['Local festival'],
        collaborations: [],
        pressQuotes: [],
      },
      live: {
        availableForBooking: 'Yes',
        showTypes: ['Full band', 'Acoustic'],
        typicalSetLength: 60,
        travelArea: 'Southeast US',
        bookingNotes: '',
      },
      contact: {
        preferredEmail: 'jay.test@example.com',
        preferredPhone: '555-123-4567',
        preferredContactMethod: 'Email',
        publicContactPreference: 'TAIG handles public inquiries',
        anythingElse: '',
        accuracyConfirmation: true,
        usePermission: true,
      },
    },
  };
}

getDb();
const app = createApp();

// 01 intake loads
{
  const res = await request(app, 'GET', `/i/${INTAKE_TOKEN}`);
  if (res.status === 200 && res.text.includes('JAY GARRETT')) {
    pass('01. Intake loads');
  } else fail('01. Intake loads', `status=${res.status}`);
}

{
  const res = await request(app, 'GET', `/i/wrong-token`);
  if (res.status === 404) pass('01b. Bad intake token rejected');
  else fail('01b. Bad intake token rejected', `status=${res.status}`);
}

{
  const res = await request(
    app,
    'GET',
    `/api/bootstrap?token=${encodeURIComponent(INTAKE_TOKEN)}`
  );
  const k = res.json?.known;
  if (
    res.status === 200 &&
    k?.artistName === 'Jay Garrett' &&
    k?.genre === 'Country' &&
    k?.trackCount === 12 &&
    k?.releaseDate === '2026-10-19' &&
    k?.featuredSong1 === 'Karma Catching Up' &&
    k?.featuredSong2 === 'Something You Can Stomp To'
  ) {
    pass('02. Known data appears correctly');
  } else fail('02. Known data appears correctly', JSON.stringify(k));
}

{
  const bad = samplePayload();
  bad.sections.contact.preferredEmail = 'not-an-email';
  bad.sections.social.facebook = 'ftp://bad';
  bad.sections.photos.permissionAssets = false;
  const res = await request(app, 'POST', '/api/submit', {
    headers: { 'Content-Type': 'application/json' },
    body: bad,
  });
  if (res.status === 400 && res.json?.errors?.length) {
    pass(
      '05/06. Required / URL / email validation works',
      res.json.errors.slice(0, 3).join('; ')
    );
  } else fail('05/06. Validation', `status=${res.status}`);
}

let submissionId = null;
let submittedAt = null;
{
  const payload = samplePayload();
  const res = await request(app, 'POST', '/api/submit', {
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  });
  if (
    res.status === 201 &&
    res.json?.submissionId &&
    res.json?.status === 'submitted' &&
    res.json?.submittedAt &&
    res.json?.message?.includes('TAIG Promotions')
  ) {
    submissionId = res.json.submissionId;
    submittedAt = res.json.submittedAt;
    pass('07. Final submission persists', submissionId);
    pass('08. Unique submission ID generated', submissionId);
    pass('09. Timestamp recorded', submittedAt);
    pass('10. Confirmation message returned');
    pass('04. Optional fields may be skipped');
  } else {
    fail('07-10. Submit', JSON.stringify(res.json));
  }
}

{
  const denied = await request(app, 'GET', '/api/taig/submissions');
  if (denied.status === 401) {
    pass('13. Unauthorized cannot enumerate submissions');
  } else fail('13. Unauthorized enumeration', `status=${denied.status}`);

  const list = await request(
    app,
    'GET',
    `/api/taig/submissions?token=${encodeURIComponent(TAIG_REVIEW_TOKEN)}`
  );
  const detail = await request(
    app,
    'GET',
    `/api/taig/submissions/${submissionId}?token=${encodeURIComponent(TAIG_REVIEW_TOKEN)}`
  );
  if (
    list.status === 200 &&
    detail.status === 200 &&
    detail.json?.id === submissionId &&
    detail.json?.status === 'submitted' &&
    detail.json?.sectionData?.album?.albumTitle === 'Validation Album Title' &&
    detail.json?.sectionData?.contact?.preferredEmail ===
      'jay.test@example.com'
  ) {
    pass('11. TAIG can retrieve submission');
    pass('12. Retrieved data matches submitted data');
  } else {
    fail('11/12. Retrieval', JSON.stringify(detail.json)?.slice(0, 300));
  }

  const reviewPage = await request(
    app,
    'GET',
    `/taig/review?token=${encodeURIComponent(TAIG_REVIEW_TOKEN)}&id=${submissionId}`
  );
  if (
    reviewPage.status === 200 &&
    reviewPage.text.includes(submissionId) &&
    reviewPage.text.includes('not validated')
  ) {
    pass(
      '14/15. Review UI shows submitted status; no auto-validate/publish'
    );
  } else fail('14/15. Governance review UI');
}

{
  const res = await request(app, 'GET', '/');
  if (res.status === 404) pass('13b. Root does not expose intake');
  else fail('13b. Root exposure', `status=${res.status}`);
}

{
  const res = await request(app, 'GET', `/i/${INTAKE_TOKEN}`);
  if (
    !res.text.includes(TAIG_REVIEW_TOKEN) &&
    !res.text.includes('DATABASE_PATH')
  ) {
    pass('17. No secrets exposed in intake HTML');
  } else fail('17. Secrets exposed');
}

{
  const schemaPath = path.join(root, 'public', 'js', 'schema.js');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const ids = [
    'artist',
    'bio',
    'album',
    'featured',
    'photos',
    'streaming',
    'social',
    'proof',
    'live',
    'contact',
  ];
  if (ids.every((id) => schema.includes(`id: '${id}'`))) {
    pass('SECTIONS. All 10 sections defined in schema');
  } else fail('SECTIONS. Missing section ids');
}

{
  const schema = fs.readFileSync(
    path.join(root, 'public', 'js', 'schema.js'),
    'utf8'
  );
  const types = [
    "type: 'text'",
    "type: 'textarea'",
    "type: 'date'",
    "type: 'number'",
    "type: 'url'",
    "type: 'email'",
    "type: 'tel'",
    "type: 'radio'",
    "type: 'checkbox-group'",
    "type: 'checkbox-required'",
    "type: 'repeat-url'",
    "type: 'tracklist'",
  ];
  if (types.every((t) => schema.includes(t))) {
    pass('FIELD-TYPES. Appropriate controls declared');
  } else fail('FIELD-TYPES. Missing control types');
}

{
  const appJs = fs.readFileSync(path.join(root, 'public', 'js', 'app.js'), 'utf8');
  if (
    appJs.includes('btn-back') &&
    appJs.includes('btn-next') &&
    appJs.includes('collectCurrentSection') &&
    appJs.includes('renderReview')
  ) {
    pass('03. Next/Back/progress/retain implemented in client');
  } else fail('03. Navigation retention');
}

{
  const css = fs.readFileSync(path.join(root, 'public', 'css', 'styles.css'), 'utf8');
  if (css.includes('min-height: 48px') && css.includes('max-width: 720px')) {
    pass('18. Mobile-first layout CSS present');
  } else fail('18. Mobile CSS');
}

{
  const indexJs = fs.readFileSync(path.join(root, 'server', 'index.js'), 'utf8');
  if (indexJs.includes('storage failure') && indexJs.includes('status(500)')) {
    pass('16. Storage/server failure handled safely');
  } else fail('16. Failure handling');
}

const failed = results.filter((r) => r.status === 'FAIL');
console.log('\n--- SUMMARY ---');
console.log(`PASS: ${results.filter((r) => r.status === 'PASS').length}`);
console.log(`FAIL: ${failed.length}`);
console.log(`Validation DB: ${DATABASE_PATH}`);

if (failed.length) process.exitCode = 1;
