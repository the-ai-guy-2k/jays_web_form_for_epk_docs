import crypto from 'node:crypto';
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
process.env.EPK_DOWNLOAD_PASSWORD = `validate-${crypto.randomBytes(12).toString('hex')}`;

// Load modules only after DATABASE_PATH is set
const { createApp } = await import('../server/index.js');
const {
  TAIG_REVIEW_TOKEN,
  DATABASE_PATH,
  EPK_DOWNLOAD_PASSWORD,
} = await import('../server/config.js');
const { getDb } = await import('../server/db.js');
const { resetDownloadThrottle } = await import('../server/epk-audio.js');

const results = [];

function pass(id, detail = '') {
  results.push({ id, status: 'PASS', detail });
  console.log(`PASS  ${id}${detail ? ' — ' + detail : ''}`);
}

function fail(id, detail = '') {
  results.push({ id, status: 'FAIL', detail });
  console.error(`FAIL  ${id}${detail ? ' — ' + detail : ''}`);
}

async function request(app, method, url, { headers = {}, body, redirect = 'follow' } = {}) {
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}${url}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      redirect,
    });
    const buffer = Buffer.from(await res.arrayBuffer());
    const text = buffer.toString('utf8');
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* html, binary, or empty */
    }
    return {
      status: res.status,
      text,
      json,
      buffer,
      location: res.headers.get('location'),
      headers: res.headers,
    };
  } finally {
    await new Promise((r) => server.close(r));
  }
}

function samplePayload() {
  return {
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

// 01 direct entry loads (ACI-008: intake moved from / to /intake; / is the public EPK)
{
  const res = await request(app, 'GET', '/intake');
  if (res.status === 200 && res.text.includes('JAY GARRETT') && res.text.includes('cartman.svg')) {
    pass('01. /intake loads themed intake');
  } else fail('01. /intake loads themed intake', `status=${res.status}`);
}

{
  const res = await request(app, 'GET', `/i/wrong-token`);
  if (res.status === 404) pass('01b. Legacy token route is not required');
  else fail('01b. Legacy token route', `status=${res.status}`);
}

{
  const res = await request(app, 'GET', '/api/bootstrap');
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

{
  const partial = {
    currentStep: 1,
    sections: {
      artist: {
        artistName: 'Jay Garrett',
        homeMarket: 'Jacksonville, Florida',
        genre: 'Country',
        genreDetail: '',
        oneLineDescription: 'Draft one-liner',
        officialWebsite: '',
      },
    },
  };
  const save = await request(app, 'POST', '/api/draft', {
    headers: { 'Content-Type': 'application/json' },
    body: partial,
  });
  if (
    save.status === 200 &&
    save.json?.status === 'draft' &&
    save.json?.resumeToken &&
    save.json?.message &&
    !String(save.json.message).toLowerCase().includes('received your electronic')
  ) {
    pass('11-draft. Partial draft saves with resume token');
  } else {
    fail('11-draft. Draft save', JSON.stringify(save.json));
  }

  const resumeToken = save.json?.resumeToken;
  if (save.json?.resumePath === `/intake?draft=${encodeURIComponent(resumeToken)}`) {
    pass('11b-draft. Resume link returns to /intake');
  } else fail('11b-draft. Resume link', 'Expected an /intake draft URL');

  const legacy = await request(app, 'GET', `/?draft=${encodeURIComponent(resumeToken)}`, {
    redirect: 'manual',
  });
  if (
    legacy.status === 302 &&
    legacy.location === `/intake?draft=${encodeURIComponent(resumeToken)}`
  ) {
    pass('11c-draft. Legacy /?draft= resume links redirect to /intake');
  } else fail('11c-draft. Legacy resume redirect', `status=${legacy.status} location=${legacy.location}`);
  const loaded = await request(
    app,
    'GET',
    `/api/draft/${encodeURIComponent(resumeToken)}`
  );
  if (
    loaded.status === 200 &&
    loaded.json?.status === 'draft' &&
    loaded.json?.sections?.artist?.homeMarket === 'Jacksonville, Florida' &&
    loaded.json?.sections?.artist?.oneLineDescription === 'Draft one-liner'
  ) {
    pass('14-15-draft. Draft reopen restores saved values');
  } else {
    fail('14-15-draft. Draft reopen', JSON.stringify(loaded.json));
  }

  // Update draft then convert to submitted
  const full = samplePayload();
  full.resumeToken = resumeToken;
  full.sections.artist.oneLineDescription = 'Draft one-liner continued';
  const submittedFromDraft = await request(app, 'POST', '/api/submit', {
    headers: { 'Content-Type': 'application/json' },
    body: full,
  });
  if (
    submittedFromDraft.status === 201 &&
    submittedFromDraft.json?.status === 'submitted'
  ) {
    pass('17-draft. Submit after resume converts draft to submitted');
  } else {
    fail('17-draft. Submit from draft', JSON.stringify(submittedFromDraft.json));
  }

  const after = await request(
    app,
    'GET',
    `/api/draft/${encodeURIComponent(resumeToken)}`
  );
  if (after.status === 409) {
    pass('23. Draft save path no longer editable after submit');
  } else {
    fail('23. Draft after submit', `status=${after.status}`);
  }

  const drafts = await request(
    app,
    'GET',
    `/api/taig/submissions?token=${encodeURIComponent(TAIG_REVIEW_TOKEN)}&status=draft`
  );
  const submittedOnly = await request(
    app,
    'GET',
    `/api/taig/submissions?token=${encodeURIComponent(TAIG_REVIEW_TOKEN)}&status=submitted`
  );
  if (
    drafts.status === 200 &&
    submittedOnly.status === 200 &&
    Array.isArray(drafts.json?.submissions) &&
    submittedOnly.json?.submissions?.some((s) => s.status === 'submitted')
  ) {
    pass('20. Draft vs submitted distinguishable in TAIG list');
  } else {
    fail('20. Status distinction');
  }
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

// 13b (ACI-008: intake shell now lives at /intake instead of /)
{
  const res = await request(app, 'GET', '/intake');
  if (
    res.status === 200 &&
    res.text.includes('Section 1 of 10') &&
    res.text.includes('/js/app.js') &&
    !res.text.includes('Open the secure link') &&
    res.headers.get('x-robots-tag')?.includes('noindex')
  ) {
    pass('13b. /intake serves intake shell (noindex) without private-link splash');
  } else fail('13b. /intake intake shell', `status=${res.status}`);
}

{
  const pages = await Promise.all(['/', '/intake'].map((u) => request(app, 'GET', u)));
  const leaks = pages.filter(
    (res) =>
      (TAIG_REVIEW_TOKEN && res.text.includes(TAIG_REVIEW_TOKEN)) ||
      res.text.includes('DATABASE_PATH') ||
      res.text.includes('DATABASE_URL') ||
      res.text.includes('TAIG_REVIEW_TOKEN')
  );
  if (!leaks.length) {
    pass('17. No secrets exposed in EPK or intake HTML');
  } else fail('17. Secrets exposed');
}

// --- ACI-008 Public Web EPK checks ---
const epk = JSON.parse(
  fs.readFileSync(path.join(root, 'content', 'jay-garrett-epk.json'), 'utf8')
);
const epkRes = await request(app, 'GET', '/');
const html = epkRes.text;
const decode = (s) =>
  s
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
const text = decode(html);

{
  if (
    epkRes.status === 200 &&
    html.includes('Electronic Press Kit') &&
    html.includes('/epk/epk.css') &&
    !html.includes('/js/app.js') &&
    !html.includes('Section 1 of 10') &&
    !html.includes('Save Progress')
  ) {
    pass('EPK-02/03. Root loads the Web EPK, not the intake');
  } else fail('EPK-02/03. Root is EPK', `status=${epkRes.status}`);
}

{
  if (
    text.includes('<h1 id="hero-title">Jay Garrett</h1>') &&
    text.includes('Jay Garrett Band') &&
    text.includes('Jacksonville / Northeast Florida') &&
    text.includes('Country') &&
    text.includes('Singer · Songwriter · Guitarist')
  ) {
    pass('EPK-04. Artist identity correct');
  } else fail('EPK-04. Artist identity');
}

{
  if (
    text.includes('Still Chasing the Sundown') &&
    text.includes('October 19, 2026') &&
    html.includes('datetime="2026-10-19"') &&
    text.includes('Scott Harter') &&
    text.includes('Nashville, Tennessee') &&
    text.includes('All songs written or co-written by Jay Garrett.')
  ) {
    pass('EPK-05/06. Album title, release date and credits correct');
  } else fail('EPK-05/06. Album facts');
}

{
  const approved = [
    'Something We Can Stomp To',
    'Same Old Lame Old',
    'Karma Catching Up',
    'Dann Run',
    "Sippin' on a Sangria",
    'Let Me Be Strong',
    'Sure Got You',
    'Why My Horse?',
    'Her Hidden Powers',
    'The Way You Carry Yourself',
    'As You Derail',
    "(You'll Find Me) Down by the River",
  ];
  const listMatch = html.match(/<ol class="tracklist">([\s\S]*?)<\/ol>/);
  const rendered = listMatch
    ? [...listMatch[1].matchAll(/<span class="track-title">([\s\S]*?)<\/span>/g)].map((m) => decode(m[1]))
    : [];
  if (
    rendered.length === 12 &&
    approved.every((t, i) => rendered[i] === t) &&
    JSON.stringify(epk.album.tracks) === JSON.stringify(approved)
  ) {
    pass('EPK-07. 12-track list correct and in order');
  } else fail('EPK-07. Track list', JSON.stringify(rendered));
}

{
  const cards = [...html.matchAll(/<h3 class="feature-title">([\s\S]*?)<\/h3>/g)].map((m) => decode(m[1]));
  const badges = (html.match(/class="track is-featured"/g) || []).length;
  if (
    cards.length === 2 &&
    cards.includes('Karma Catching Up') &&
    cards.includes('Something We Can Stomp To') &&
    badges === 2
  ) {
    pass('EPK-08. Featured tracks correct');
  } else fail('EPK-08. Featured tracks', JSON.stringify(cards));
}

{
  const approvedBio = [
    'Jay Garrett is a Jacksonville-area singer, songwriter and guitarist with a catalog released under both his own name and Jay Garrett Band. His solo releases include Broken in Four, Strange and Daytona Bound, while Jay Garrett Band released The Nashville Sessions in 2019 and Weighed Down, For Way Too Long in 2022.',
    'Jay\'s Northeast Florida music history reaches back to at least the late 2000s, with Jacksonville-area event records and documented live performances. More recently, he continued releasing new music with the 2025 singles "Same Old Lame Old" and "Sippin\' on a Sangria."',
    'His next project, Still Chasing the Sundown, is a 12-song country album planned for release on October 19, 2026. The album was produced and engineered by Scott Harter in Nashville, Tennessee, with all songs written or co-written by Jay Garrett.',
  ];
  if (approvedBio.every((p) => text.includes(`<p>${p}</p>`))) {
    pass('EPK-09. Approved GVCA bio rendered verbatim');
  } else fail('EPK-09. Bio mismatch');
}

const hrefs = [...html.matchAll(/href="(https:[^"]+)"/g)].map((m) => decode(m[1]));
{
  const expected = {
    'Spotify — Jay Garrett': 'https://open.spotify.com/artist/5YOopHdU7HYWvT6dZV137W',
    'Spotify — Jay Garrett Band': 'https://open.spotify.com/artist/3bcSjBtwGPuUwsrqmopdah',
    'Apple Music — Jay Garrett': 'https://music.apple.com/us/artist/jay-garrett/3978898',
    'Apple Music — Jay Garrett Band': 'https://music.apple.com/us/artist/jay-garrett-band/1473713956',
    'Amazon Music — Jay Garrett Band': 'https://music.amazon.com/artists/B07VH6Z93K/jay-garrett-band',
    'YouTube — Jay Garrett Band': 'https://www.youtube.com/channel/UCf_pTuQJN5m7HDy82lryEeQ/about',
  };
  const mapped = {};
  for (const g of epk.listen) {
    for (const l of g.links) mapped[`${l.platform} — ${g.group}`] = l.url;
  }
  const missing = Object.entries(expected).filter(
    ([k, url]) => mapped[k] !== url || !hrefs.includes(url)
  );
  if (!missing.length && Object.keys(mapped).length === 6) {
    pass('EPK-10. Streaming links present and correctly mapped');
  } else fail('EPK-10. Streaming links', JSON.stringify(missing));
}

{
  const socialOk =
    hrefs.includes('https://www.jaygarrettmusic.com/') &&
    hrefs.includes('https://www.facebook.com/jay.garrett.167/');
  const approvedHosts = new Set([
    'open.spotify.com',
    'music.apple.com',
    'music.amazon.com',
    'www.youtube.com',
    'www.facebook.com',
    'www.jaygarrettmusic.com',
  ]);
  const unapproved = hrefs.filter((h) => !approvedHosts.has(new URL(h).hostname));
  if (socialOk && !unapproved.length) {
    pass('EPK-11. Social/website links mapped; no unapproved accounts');
  } else fail('EPK-11. Social links', JSON.stringify(unapproved));
}

{
  const externals = [...html.matchAll(/<a [^>]*target="_blank"[^>]*>/g)].map((m) => m[0]);
  if (externals.length && externals.every((a) => a.includes('rel="noopener noreferrer"'))) {
    pass('EPK-EXT. External links open safely in a new tab');
  } else fail('EPK-EXT. External link attributes');
}

{
  const banned = [
    /award/i,
    /grammy/i,
    /billboard/i,
    /\bstreams\b/i,
    /monthly listeners/i,
    /testimonial/i,
    /chart-topping/i,
    /cartman/i,
    /resume/i,
    /submission/i,
    /\/taig\//i,
    /\/api\//i,
  ];
  const hits = banned.filter((re) => re.test(html));
  if (!hits.length) {
    pass('EPK-TRUTH. No fabricated claims, intake/admin references, or API links on EPK');
  } else fail('EPK-TRUTH. Forbidden content', hits.map(String).join(', '));
}

{
  const imgs = [...html.matchAll(/<img [^>]*>/g)].map((m) => m[0]);
  const missingAlt = imgs.filter((i) => !/alt="[^"]+"/.test(i));
  if (
    html.includes('<a class="skip-link" href="#main">') &&
    html.includes('aria-controls="site-nav"') &&
    html.includes('lang="en"') &&
    !missingAlt.length &&
    (html.match(/<h1[\s>]/g) || []).length === 1
  ) {
    pass('EPK-A11Y. Skip link, labelled nav toggle, single h1, image alt text');
  } else fail('EPK-A11Y. Accessibility basics');
}

{
  const css = await request(app, 'GET', '/epk/epk.css');
  const js = await request(app, 'GET', '/epk/epk.js');
  const assets = [...html.matchAll(/(?:src|href)="(\/[^"#]+)"/g)].map((m) => m[1]);
  const statuses = await Promise.all(assets.map((a) => request(app, 'GET', a)));
  const broken = assets.filter((_, i) => statuses[i].status !== 200);
  if (css.status === 200 && js.status === 200 && !broken.length) {
    pass('EPK-ASSETS. All local EPK assets resolve (no broken media)', `${assets.length} assets`);
  } else fail('EPK-ASSETS. Broken local assets', broken.join(', '));
}

{
  const { renderEpkPage } = await import('../server/epk.js');
  const stripped = { ...epk, album: { ...epk.album, artwork: null }, photos: [] };
  const fallback = renderEpkPage(stripped);
  if (
    fallback.includes('class="cover-fallback"') &&
    !fallback.includes('<img') &&
    !fallback.includes('Download album artwork') &&
    !fallback.includes('id="photos"')
  ) {
    pass('EPK-21. Missing artwork/photos degrade gracefully');
  } else fail('EPK-21. Missing asset handling');
}

{
  const csp = epkRes.headers.get('content-security-policy') || '';
  if (csp.includes("default-src 'self'") && epkRes.headers.get('x-content-type-options') === 'nosniff') {
    pass('EPK-HEADERS. CSP and nosniff set on public EPK');
  } else fail('EPK-HEADERS. Security headers');
}

{
  const probes = [
    '/api/taig/submissions',
    '/taig/review',
    '/content/jay-garrett-epk.json',
    '/data/submissions.sqlite',
    '/.env',
    '/server/config.js',
    '/media/masters/03Karma%20Catching%20Up%20MSTR%2024bit_48hz.wav',
    '/media/masters/01Stomp%20to%20MIX%20MSTR%2024bit_48hz.wav',
  ];
  const results = await Promise.all(probes.map((p) => request(app, 'GET', p)));
  const exposed = probes.filter((_, i) => results[i].status === 200);
  if (!exposed.length) {
    pass('EPK-14/15. Private/admin/raw data routes not publicly reachable');
  } else fail('EPK-14/15. Exposed routes', exposed.join(', '));
}

{
  const source = fs.readFileSync(path.join(root, 'public', 'js', 'app.js'), 'utf8');
  if (
    source.includes("view: 'form'") &&
    source.includes("fetch('/api/bootstrap')") &&
    !source.includes('btn-start') &&
    !source.includes('intakeToken')
  ) pass('ENTRY. Form boots directly without an intake access token or Start button');
  else fail('ENTRY. Direct-entry client code');
}

{
  const deniedReview = await request(app, 'GET', '/taig/review');
  const deniedExport = await request(app, 'GET', `/api/taig/submissions/${submissionId}/export.json`);
  if (deniedReview.status === 401 && deniedExport.status === 401) {
    pass('SECURITY. TAIG review and export remain protected');
  } else fail('SECURITY. TAIG protection', `review=${deniedReview.status}, export=${deniedExport.status}`);
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
    appJs.includes('renderReview') &&
    appJs.includes('saveDraft') &&
    appJs.includes('btn-save')
  ) {
    pass('03. Next/Back/progress/retain + Save Progress implemented');
  } else fail('03. Navigation retention / save');
}

{
  const css = fs.readFileSync(path.join(root, 'public', 'css', 'styles.css'), 'utf8');
  if (
    css.includes('min-height: 48px') &&
    css.includes('max-width: 760px') &&
    css.includes('site-header') &&
    css.includes('--gold') &&
    css.includes('sidebar') &&
    css.includes('.card-mascot')
  ) {
    pass('18. Mobile-first Cartman theme CSS present');
  } else fail('18. Mobile CSS');
}

{
  const appJs = fs.readFileSync(path.join(root, 'public', 'js', 'app.js'), 'utf8');
  if (
    !appJs.includes("Let's Get Started") &&
    appJs.includes('Review Your Information') &&
    appJs.includes('Thank You!') &&
    appJs.includes('cartman-celebrate.svg')
  ) {
    pass('THEME. Intake / Review / Thank You Cartman screens present');
  } else fail('THEME. Missing themed screens');
}

{
  const indexJs = fs.readFileSync(path.join(root, 'server', 'index.js'), 'utf8');
  if (indexJs.includes('storage failure') && indexJs.includes('status(500)')) {
    pass('16. Storage/server failure handled safely');
  } else fail('16. Failure handling');
}


{
  const appJs = fs.readFileSync(path.join(root, 'public', 'js', 'app.js'), 'utf8');
  const submitStart = appJs.indexOf('async function submitAll()');
  const submitEnd = appJs.indexOf('\n  function render()', submitStart);
  const submitHandler = appJs.slice(submitStart, submitEnd);
  const invalidPath = submitHandler.indexOf('if (!validateSection(i))');
  const formTransition = submitHandler.indexOf("state.view = 'form'", invalidPath);
  const rerender = submitHandler.indexOf('render()', invalidPath);
  if (invalidPath >= 0 && formTransition > invalidPath && rerender > formTransition) {
    pass('SUBMIT. Missing fields return to the first invalid section');
  } else {
    fail('SUBMIT. Missing fields remain on Review without feedback');
  }
}

// --- ACI-009 Manage EPK placeholder checks ---
{
  const footer = html.match(/<footer class="footer">([\s\S]*?)<\/footer>/)?.[1] || '';
  const nav = html.match(/<nav id="site-nav"[\s\S]*?<\/nav>/)?.[0] || '';
  const hero = html.match(/<section id="top"[\s\S]*?<\/section>/)?.[0] || '';
  if (
    footer.includes('<a href="/manage">Manage EPK</a>') &&
    !nav.includes('/manage') &&
    !hero.includes('/manage') &&
    (html.match(/href="\/manage"/g) || []).length === 1
  ) {
    pass('MANAGE-ENTRY. Secondary "Manage EPK" link in EPK footer only');
  } else fail('MANAGE-ENTRY. Manage entry point placement');
}

const manageRes = await request(app, 'GET', '/manage');
const manageHtml = manageRes.text;
{
  if (
    manageRes.status === 200 &&
    manageHtml.includes('<h1 id="manage-title">Coming soon</h1>') &&
    manageHtml.includes('Jay Garrett EPK Management') &&
    manageHtml.includes('/epk/epk.css') &&
    manageRes.headers.get('x-robots-tag')?.includes('noindex') &&
    (manageRes.headers.get('content-security-policy') || '').includes("default-src 'self'")
  ) {
    pass('MANAGE-PAGE. /manage renders branded Coming Soon page (noindex, CSP)');
  } else fail('MANAGE-PAGE. /manage page', `status=${manageRes.status}`);
}

{
  const back = manageHtml.includes('<a class="btn" href="/">Return to EPK</a>');
  const home = await request(app, 'GET', '/');
  if (back && home.status === 200 && home.text.includes('<h1 id="hero-title">Jay Garrett</h1>')) {
    pass('MANAGE-RETURN. Return to EPK routes to / which serves the EPK');
  } else fail('MANAGE-RETURN. Return link');
}

{
  const forbidden = [/<form/i, /<input/i, /<textarea/i, /<select/i, /password/i, /log ?in/i, /sign ?in/i, /<script/i, /\/api\//i, /%/, /contentVersion/, /featuredTracks/];
  const hits = forbidden.filter((re) => re.test(manageHtml));
  const writes = await Promise.all(
    ['POST', 'PUT', 'PATCH', 'DELETE'].map((m) =>
      request(app, m, '/manage', { headers: { 'Content-Type': 'application/json' }, body: { artist: { name: 'x' } } })
    )
  );
  const accepted = writes.filter((w) => w.status < 400);
  const after = await request(app, 'GET', '/');
  if (!hits.length && !accepted.length && after.text === html) {
    pass('MANAGE-SCOPE. No forms, credentials, scripts, data exposure, or write methods; EPK unchanged');
  } else fail('MANAGE-SCOPE. Scope boundary', `${hits.map(String).join(', ')} accepted=${accepted.length}`);
}

{
  if (
    (TAIG_REVIEW_TOKEN ? !manageHtml.includes(TAIG_REVIEW_TOKEN) : true) &&
    !/DATABASE|TOKEN|submission|resume|draft/i.test(manageHtml)
  ) {
    pass('MANAGE-PRIVACY. No secrets or intake/admin data on /manage');
  } else fail('MANAGE-PRIVACY. /manage leaks');
}

// --- ACI-012 featured audio + protected download ---
const audioJs = fs.readFileSync(path.join(root, 'public', 'epk', 'epk.js'), 'utf8');
{
  const karmaPlayer = html.includes('src="/epk/audio/jay-garrett-karma-catching-up.mp3"');
  const stompPlayer = html.includes('src="/epk/audio/jay-garrett-something-we-can-stomp-to.mp3"');
  const noAutoplay = !html.includes('autoplay');
  const exclusive = audioJs.includes('other.pause()');
  if (karmaPlayer && stompPlayer && noAutoplay && exclusive) {
    pass('AUDIO-PLAYER. Featured players present, no autoplay, one-at-a-time pause');
  } else fail('AUDIO-PLAYER. Featured player markup');
}

{
  if (
    html.includes('id="download-dialog"') &&
    html.includes('<label for="download-password">Password</label>') &&
    html.includes('js-download-cancel') &&
    html.includes('Download featured track') &&
    !html.includes('/api/epk/download')
  ) {
    pass('AUDIO-UI. Password dialog is labeled, closable, and does not expose the download endpoint in HTML');
  } else fail('AUDIO-UI. Download dialog');
}

{
  const css = fs.readFileSync(path.join(root, 'public', 'epk', 'epk.css'), 'utf8');
  if (css.includes('.epk-player') && css.includes('.download-dialog') && css.includes('.js-download')) {
    pass('AUDIO-PRINT. Player and download UI hidden in print stylesheet');
  } else fail('AUDIO-PRINT. Print CSS');
}

{
  const mp3Karma = await request(app, 'GET', '/epk/audio/jay-garrett-karma-catching-up.mp3');
  const mp3Stomp = await request(app, 'GET', '/epk/audio/jay-garrett-something-we-can-stomp-to.mp3');
  if (mp3Karma.status === 200 && mp3Stomp.status === 200 && mp3Karma.buffer.length > 1000 && mp3Stomp.buffer.length > 1000) {
    pass('AUDIO-PLAYBACK. Public MP3 playback files resolve', `${mp3Karma.buffer.length} / ${mp3Stomp.buffer.length} bytes`);
  } else fail('AUDIO-PLAYBACK. MP3 assets');
}

{
  const sources = [
    path.join(root, 'content', 'jay-garrett-epk.json'),
    path.join(root, 'public', 'epk', 'epk.js'),
    path.join(root, 'server', 'epk.js'),
  ];
  const leaked = sources.filter((file) => fs.readFileSync(file, 'utf8').includes(EPK_DOWNLOAD_PASSWORD));
  if (
    !html.includes(EPK_DOWNLOAD_PASSWORD) &&
    !audioJs.includes(EPK_DOWNLOAD_PASSWORD) &&
    !leaked.length
  ) {
    pass('AUDIO-SECRET. Download password absent from HTML, JS, and artist JSON');
  } else fail('AUDIO-SECRET. Password leaked into client-visible source');
}

{
  const blank = await request(app, 'POST', '/api/epk/download', {
    headers: { 'Content-Type': 'application/json' },
    body: { trackId: 'karma-catching-up', password: '' },
  });
  const wrong = await request(app, 'POST', '/api/epk/download', {
    headers: { 'Content-Type': 'application/json' },
    body: { trackId: 'karma-catching-up', password: 'definitely-wrong' },
  });
  if (blank.status === 401 && wrong.status === 401 && wrong.json?.error === 'Incorrect download password.') {
    pass('AUDIO-AUTH-FAIL. Blank and wrong passwords are rejected');
  } else fail('AUDIO-AUTH-FAIL. Unexpected auth failure response');
}

{
  resetDownloadThrottle();
  const badId = await request(app, 'POST', '/api/epk/download', {
    headers: { 'Content-Type': 'application/json' },
    body: { trackId: 'not-a-track', password: EPK_DOWNLOAD_PASSWORD },
  });
  const traversal = await request(app, 'POST', '/api/epk/download', {
    headers: { 'Content-Type': 'application/json' },
    body: { trackId: '../server/config.js', password: EPK_DOWNLOAD_PASSWORD },
  });
  const encoded = await request(app, 'POST', '/api/epk/download', {
    headers: { 'Content-Type': 'application/json' },
    body: { trackId: '..%2Fserver%2Fconfig.js', password: EPK_DOWNLOAD_PASSWORD },
  });
  const filename = await request(app, 'POST', '/api/epk/download', {
    headers: { 'Content-Type': 'application/json' },
    body: {
      trackId: 'karma-catching-up',
      password: 'nope',
      filename: '01Stomp to MIX MSTR 24bit_48hz.wav',
    },
  });
  if (
    badId.status === 400 &&
    traversal.status === 400 &&
    encoded.status === 400 &&
    filename.status === 401
  ) {
    pass('AUDIO-PATH. Unsupported IDs, traversal, and client filenames cannot select files');
  } else fail('AUDIO-PATH. File-selection controls');
}

{
  resetDownloadThrottle();
  const karma = await request(app, 'POST', '/api/epk/download', {
    headers: { 'Content-Type': 'application/json' },
    body: { trackId: 'karma-catching-up', password: EPK_DOWNLOAD_PASSWORD },
  });
  const stomp = await request(app, 'POST', '/api/epk/download', {
    headers: { 'Content-Type': 'application/json' },
    body: { trackId: 'something-we-can-stomp-to', password: EPK_DOWNLOAD_PASSWORD },
  });
  const karmaOk =
    karma.status === 200 &&
    karma.headers.get('content-disposition')?.includes('Jay-Garrett-Karma-Catching-Up.wav') &&
    karma.buffer.length === 77377074 &&
    karma.buffer.slice(0, 4).toString() === 'RIFF';
  const stompOk =
    stomp.status === 200 &&
    stomp.headers.get('content-disposition')?.includes('Jay-Garrett-Something-We-Can-Stomp-To.wav') &&
    stomp.buffer.length === 59968382 &&
    stomp.buffer.slice(0, 4).toString() === 'RIFF';
  if (karmaOk && stompOk) {
    pass('AUDIO-AUTH-OK. Correct password returns the approved WAV masters');
  } else {
    fail(
      'AUDIO-AUTH-OK. Download payload',
      `karma=${karma.status}/${karma.buffer?.length} stomp=${stomp.status}/${stomp.buffer?.length}`
    );
  }
}

{
  resetDownloadThrottle();
  let last;
  for (let i = 0; i < 6; i += 1) {
    last = await request(app, 'POST', '/api/epk/download', {
      headers: { 'Content-Type': 'application/json' },
      body: { trackId: 'karma-catching-up', password: 'wrong' },
    });
  }
  if (last.status === 429) {
    pass('AUDIO-THROTTLE. Repeated failures are rate-limited');
  } else fail('AUDIO-THROTTLE. Expected 429 after repeated failures', `status=${last.status}`);
  resetDownloadThrottle();
}

{
  const method = await request(app, 'GET', '/api/epk/download');
  if (method.status === 405) pass('AUDIO-METHOD. GET download endpoint is not allowed');
  else fail('AUDIO-METHOD. GET should be 405', `status=${method.status}`);
}

const failed = results.filter((r) => r.status === 'FAIL');
console.log('\n--- SUMMARY ---');
console.log(`PASS: ${results.filter((r) => r.status === 'PASS').length}`);
console.log(`FAIL: ${failed.length}`);
console.log(`Validation DB: ${DATABASE_PATH}`);

if (failed.length) process.exitCode = 1;
