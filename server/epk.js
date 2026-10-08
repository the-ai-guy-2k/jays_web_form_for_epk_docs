import fs from 'node:fs';
import path from 'node:path';
import { ROOT_DIR } from './config.js';

export const EPK_CONTENT_PATH = path.join(ROOT_DIR, 'content', 'jay-garrett-epk.json');

export function loadEpkContent(file = EPK_CONTENT_PATH) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(url) {
  const value = String(url || '');
  if (/^https:\/\//i.test(value) || value.startsWith('/')) return value;
  return '';
}

function externalLink(url, label, className = '') {
  const href = safeUrl(url);
  if (!href) return '';
  return `<a class="${esc(className)}" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}<span class="visually-hidden"> (opens in a new tab)</span></a>`;
}

function renderCover(album, artistName) {
  const art = album.artwork;
  if (art && safeUrl(art.src)) {
    return `<img class="cover-img" src="${esc(art.src)}" alt="${esc(art.alt || `${album.title} album cover`)}"${art.width ? ` width="${Number(art.width)}"` : ''}${art.height ? ` height="${Number(art.height)}"` : ''} decoding="async" />`;
  }
  return `<div class="cover-fallback" role="img" aria-label="${esc(album.title)} — ${esc(artistName)}">
      <span class="cover-fallback-artist">${esc(artistName)}</span>
      <span class="cover-fallback-title">${esc(album.title)}</span>
    </div>`;
}

function renderPhotos(photos) {
  const usable = (photos || []).filter((p) => safeUrl(p.src));
  if (!usable.length) return '';
  const items = usable
    .map(
      (p) => `<figure class="photo">
        <img src="${esc(p.src)}" alt="${esc(p.alt || '')}" loading="lazy" decoding="async" />
        ${p.credit ? `<figcaption>Photo: ${esc(p.credit)}</figcaption>` : ''}
      </figure>`
    )
    .join('');
  return `<section id="photos" class="section" aria-labelledby="photos-title">
    <div class="wrap">
      <p class="eyebrow">Press photos</p>
      <h2 id="photos-title">Photography</h2>
      <div class="photo-grid">${items}</div>
    </div>
  </section>`;
}

function renderDownloads(album) {
  const art = album.artwork;
  if (!art || !safeUrl(art.src) || !art.downloadable) return '';
  return `<a class="btn btn-ghost" href="${esc(art.src)}" download>Download album artwork</a>`;
}

export function renderEpkPage(content) {
  const { artist, album, bio, listen, social, contact } = content;
  const featured = new Set(album.featuredTracks || []);
  const rolesText = (artist.roles || []).join(' · ');
  const primaryListen = listen?.[0]?.links?.[0];

  const trackItems = (album.tracks || [])
    .map((title) => {
      const isFeatured = featured.has(title);
      return `<li class="track${isFeatured ? ' is-featured' : ''}"><span class="track-title">${esc(title)}</span>${isFeatured ? '<span class="badge">Featured</span>' : ''}</li>`;
    })
    .join('');

  const featuredAudioByTitle = new Map(
    (album.featuredAudio || []).map((item) => [item.title, item])
  );
  const featuredCards = (album.featuredTracks || [])
    .map((title) => {
      const number = (album.tracks || []).indexOf(title) + 1;
      const audio = featuredAudioByTitle.get(title);
      const playback = audio && safeUrl(audio.playbackSrc);
      const trackId = audio?.id ? String(audio.id) : '';
      const player = playback
        ? `<audio class="epk-player" controls preload="metadata" controlslist="nodownload noplaybackrate" src="${esc(playback)}" data-track-id="${esc(trackId)}"></audio>
          <button type="button" class="btn btn-ghost js-download" data-track-id="${esc(trackId)}" data-track-title="${esc(title)}">Download</button>`
        : '';
      return `<li class="feature-card">
          <div class="feature-head">
            <span class="feature-num" aria-hidden="true">${number > 0 ? String(number).padStart(2, '0') : ''}</span>
            <div>
              <p class="feature-label">Featured track${number > 0 ? ` · Track ${number}` : ''}</p>
              <h3 class="feature-title">${esc(title)}</h3>
              <p class="feature-meta">From <em>${esc(album.title)}</em></p>
            </div>
          </div>
          ${player}
        </li>`;
    })
    .join('');

  const listenGroups = (listen || [])
    .map(
      (group) => `<div class="link-group">
        <h3>${esc(group.group)}</h3>
        <ul class="link-list">${group.links
          .map((l) => `<li>${externalLink(l.url, l.platform, 'platform-link')}</li>`)
          .join('')}</ul>
      </div>`
    )
    .join('');

  const socialLinks = (social || [])
    .map((s) => `<li>${externalLink(s.url, s.label, 'platform-link')}</li>`)
    .join('');

  const contactLines = [];
  if (contact?.representation) {
    contactLines.push(
      `<p class="contact-rep"><span class="contact-label">Press, radio &amp; booking</span>${esc(contact.representation)}</p>`
    );
  }
  if (contact?.email) {
    contactLines.push(
      `<p><a class="btn" href="mailto:${esc(contact.email)}">${esc(contact.email)}</a></p>`
    );
  }
  if (contact?.phone) {
    contactLines.push(
      `<p><a href="tel:${esc(String(contact.phone).replace(/[^\d+]/g, ''))}">${esc(contact.phone)}</a></p>`
    );
  }
  if (contact?.website) {
    contactLines.push(
      `<p>${externalLink(contact.website, 'Visit jaygarrettmusic.com', 'btn btn-ghost')}</p>`
    );
  }

  const title = `${artist.name} — Electronic Press Kit | ${album.title}`;
  const description = `${artist.name} (${artist.band}) — ${artist.genre} ${rolesText.toLowerCase()} from ${artist.region}. New album ${album.title}, out ${album.releaseDateDisplay}.`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  ${album.artwork && safeUrl(album.artwork.src) ? `<meta property="og:image" content="${esc(album.artwork.src)}" />` : ''}
  <meta name="theme-color" content="#1b1310" />
  <link rel="stylesheet" href="/epk/epk.css" />
  <script src="/epk/epk.js" defer></script>
</head>
<body class="epk">
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="topbar">
    <div class="wrap topbar-inner">
      <a class="brand" href="#top">${esc(artist.name)}<span class="brand-sub">Electronic Press Kit</span></a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">
        <span class="nav-toggle-bar" aria-hidden="true"></span>
        <span class="visually-hidden">Menu</span>
      </button>
      <nav id="site-nav" class="site-nav" aria-label="EPK sections">
        <ul>
          <li><a href="#album">Album</a></li>
          <li><a href="#tracks">Tracks</a></li>
          <li><a href="#bio">Bio</a></li>
          <li><a href="#listen">Listen</a></li>
          <li><a href="#contact">Contact</a></li>
        </ul>
      </nav>
    </div>
  </header>

  <main id="main">
    <section id="top" class="hero" aria-labelledby="hero-title">
      <div class="wrap hero-inner">
        <div class="hero-copy">
          <p class="eyebrow">${esc(artist.genre)} · ${esc(artist.region)}</p>
          <h1 id="hero-title">${esc(artist.name)}</h1>
          <p class="hero-band">${esc(artist.band)}</p>
          <p class="hero-roles">${esc(rolesText)}</p>
          <div class="hero-release">
            <p class="hero-release-label">New album</p>
            <p class="hero-release-title">${esc(album.title)}</p>
            <p class="hero-release-date">Out <time datetime="${esc(album.releaseDate)}">${esc(album.releaseDateDisplay)}</time></p>
          </div>
          <div class="hero-actions">
            <a class="btn" href="#album">Explore the album</a>
            ${primaryListen ? externalLink(primaryListen.url, `Listen on ${primaryListen.platform}`, 'btn btn-ghost') : ''}
          </div>
        </div>
        <div class="hero-cover">${renderCover(album, artist.band || artist.name)}</div>
      </div>
    </section>

    <section id="album" class="section" aria-labelledby="album-title">
      <div class="wrap">
        <p class="eyebrow">The new album</p>
        <h2 id="album-title"><em>${esc(album.title)}</em></h2>
        <dl class="facts">
          <div><dt>Release date</dt><dd><time datetime="${esc(album.releaseDate)}">${esc(album.releaseDateDisplay)}</time></dd></div>
          <div><dt>Tracks</dt><dd>${esc(album.trackCount)}</dd></div>
          <div><dt>Genre</dt><dd>${esc(artist.genre)}</dd></div>
          <div><dt>Produced &amp; engineered by</dt><dd>${esc(album.producedAndEngineeredBy)}</dd></div>
          <div><dt>Production location</dt><dd>${esc(album.productionLocation)}</dd></div>
          <div><dt>Songwriting</dt><dd>${esc(album.songwriting)}</dd></div>
        </dl>
        ${renderDownloads(album)}
      </div>
    </section>

    <section id="featured" class="section section-alt" aria-labelledby="featured-title">
      <div class="wrap">
        <p class="eyebrow">Start here</p>
        <h2 id="featured-title">Featured tracks</h2>
        <ul class="feature-list">${featuredCards}</ul>
        <p class="note"><a href="#listen">Find Jay's music on streaming platforms</a></p>
      </div>
    </section>

    <section id="tracks" class="section" aria-labelledby="tracks-title">
      <div class="wrap">
        <p class="eyebrow">${esc(album.trackCount)} songs</p>
        <h2 id="tracks-title">Track list</h2>
        <ol class="tracklist">${trackItems}</ol>
      </div>
    </section>

    <section id="bio" class="section section-alt" aria-labelledby="bio-title">
      <div class="wrap wrap-narrow">
        <p class="eyebrow">About</p>
        <h2 id="bio-title">Biography</h2>
        <div class="bio">${(bio || []).map((p) => `<p>${esc(p)}</p>`).join('')}</div>
      </div>
    </section>

    ${renderPhotos(content.photos)}

    <section id="listen" class="section" aria-labelledby="listen-title">
      <div class="wrap">
        <p class="eyebrow">Music &amp; video</p>
        <h2 id="listen-title">Listen</h2>
        <div class="link-groups">${listenGroups}</div>
      </div>
    </section>

    <section id="connect" class="section section-alt" aria-labelledby="connect-title">
      <div class="wrap">
        <p class="eyebrow">Online</p>
        <h2 id="connect-title">Connect</h2>
        <ul class="link-list">${socialLinks}</ul>
      </div>
    </section>

    <section id="contact" class="section" aria-labelledby="contact-title">
      <div class="wrap wrap-narrow">
        <p class="eyebrow">Media</p>
        <h2 id="contact-title">Contact</h2>
        ${contactLines.join('\n        ')}
        <p><button class="btn btn-ghost js-print" type="button">Print / save one-sheet</button></p>
      </div>
    </section>
  </main>

  ${renderFooter(artist, contact)}
  ${renderDownloadDialog()}
</body>
</html>`;
}

function renderDownloadDialog() {
  return `<dialog class="download-dialog" id="download-dialog" aria-labelledby="download-dialog-title" aria-describedby="download-dialog-copy">
    <form class="download-form" id="download-form">
      <h2 id="download-dialog-title">Download featured track</h2>
      <p id="download-dialog-copy">This download is available to authorized media, radio and industry recipients.</p>
      <p class="download-track-name" id="download-track-name"></p>
      <div class="download-field">
        <label for="download-password">Password</label>
        <input id="download-password" name="password" type="password" autocomplete="off" required />
      </div>
      <p class="download-error" id="download-error" role="alert" hidden></p>
      <div class="download-actions">
        <button type="submit" class="btn" id="download-submit">Download track</button>
        <button type="button" class="btn btn-ghost js-download-cancel">Cancel</button>
      </div>
    </form>
  </dialog>`;
}

function renderFooter(artist, contact, { onManage = false } = {}) {
  return `<footer class="footer">
    <div class="wrap footer-inner">
      <div>
        <p>&copy; ${new Date().getFullYear()} ${esc(artist.name)}. All rights reserved.</p>
        ${contact?.representation ? `<p>Presented by ${esc(contact.representation)}.</p>` : ''}
      </div>
      <p class="footer-manage"><a href="/manage"${onManage ? ' aria-current="page"' : ''}>Manage EPK</a></p>
    </div>
  </footer>`;
}

export function renderManagePage(content) {
  const { artist, album, contact } = content;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>EPK Management — Coming Soon | ${esc(artist.name)}</title>
  <meta name="robots" content="noindex, nofollow" />
  <meta name="theme-color" content="#1b1310" />
  <link rel="stylesheet" href="/epk/epk.css" />
</head>
<body class="epk">
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="topbar">
    <div class="wrap topbar-inner">
      <a class="brand" href="/">${esc(artist.name)}<span class="brand-sub">Electronic Press Kit</span></a>
    </div>
  </header>

  <main id="main">
    <section class="hero manage-hero" aria-labelledby="manage-title">
      <div class="wrap wrap-narrow manage-inner">
        <p class="eyebrow">${esc(artist.name)} EPK Management</p>
        <h1 id="manage-title">Coming soon</h1>
        <p class="manage-lead">A secure management experience is being developed so that authorized members of ${esc(artist.name)}'s team can keep this EPK's content up to date.</p>
        <p class="manage-note">Until then, the public EPK for <em>${esc(album.title)}</em> remains the current, approved press destination.</p>
        <div class="hero-actions">
          <a class="btn" href="/">Return to EPK</a>
        </div>
      </div>
    </section>
  </main>

  ${renderFooter(artist, contact, { onManage: true })}
</body>
</html>`;
}
