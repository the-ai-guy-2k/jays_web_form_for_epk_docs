const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function asString(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function validateUrl(value, label, errors, { required = false } = {}) {
  const v = asString(value);
  if (!v) {
    if (required) errors.push(`${label} is required.`);
    return;
  }
  if (!URL_RE.test(v)) {
    errors.push(`${label} must be a valid http:// or https:// link.`);
  }
}

function validateEmail(value, label, errors, { required = false } = {}) {
  const v = asString(value);
  if (!v) {
    if (required) errors.push(`${label} is required.`);
    return;
  }
  if (!EMAIL_RE.test(v)) {
    errors.push(`${label} must be a valid email address.`);
  }
}

function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

/**
 * Server-side validation for final submission.
 * Returns { ok, errors, fieldErrors, normalized }
 */
export function validateSubmission(payload) {
  const errors = [];
  const fieldErrors = {};
  const data = payload?.sections || payload || {};

  function addField(key, message) {
    errors.push(message);
    if (!fieldErrors[key]) fieldErrors[key] = [];
    fieldErrors[key].push(message);
  }

  const artist = data.artist || {};
  const album = data.album || {};
  const photos = data.photos || {};
  const social = data.social || {};
  const contact = data.contact || {};

  if (isBlank(artist.artistName)) {
    addField('artist.artistName', 'Artist name is required.');
  }
  if (isBlank(artist.homeMarket)) {
    addField('artist.homeMarket', 'Home market / city is required.');
  }
  if (isBlank(artist.genre)) {
    addField('artist.genre', 'Genre is required.');
  }
  if (isBlank(artist.oneLineDescription)) {
    addField(
      'artist.oneLineDescription',
      'One-line artist description is required.'
    );
  }
  validateUrl(artist.officialWebsite, 'Official website', errors);

  const bio = data.bio || {};
  if (isBlank(bio.hometownOrigin)) {
    addField('bio.hometownOrigin', 'Hometown / origin is required.');
  }

  if (isBlank(album.albumTitle)) {
    addField('album.albumTitle', 'Album title is required.');
  }
  if (isBlank(album.releaseDate)) {
    addField('album.releaseDate', 'Release date is required.');
  }
  if (isBlank(album.trackCount) && album.trackCount !== 0) {
    addField('album.trackCount', 'Track count is required.');
  }
  if (isBlank(album.albumStory)) {
    addField('album.albumStory', 'Album story is required.');
  }
  if (isBlank(album.producerCredit)) {
    addField('album.producerCredit', 'Producer credit is required.');
  }

  const featured = data.featured || {};
  if (isBlank(featured.featuredSong1)) {
    addField('featured.featuredSong1', 'Featured song 1 is required.');
  }
  if (isBlank(featured.song1Story)) {
    addField('featured.song1Story', 'Song 1 story is required.');
  }
  if (isBlank(featured.featuredSong2)) {
    addField('featured.featuredSong2', 'Featured song 2 is required.');
  }
  if (isBlank(featured.song2Story)) {
    addField('featured.song2Story', 'Song 2 story is required.');
  }
  validateUrl(featured.song1Link, 'Song 1 link', errors);
  validateUrl(featured.song2Link, 'Song 2 link', errors);
  if (!['Yes', 'No', 'Not Sure'].includes(asString(featured.cleanRadioReady))) {
    addField(
      'featured.cleanRadioReady',
      'Please select whether clean / radio-ready versions are available.'
    );
  }

  validateUrl(photos.primaryArtistPhoto, 'Primary artist photo', errors, {
    required: true,
  });
  for (const url of ensureArray(photos.additionalArtistPhotos)) {
    validateUrl(url, 'Additional artist photo', errors);
  }
  for (const url of ensureArray(photos.livePhotos)) {
    validateUrl(url, 'Live photo', errors);
  }
  validateUrl(photos.albumArtworkUpdate, 'Album artwork update', errors);
  validateUrl(photos.artistLogo, 'Artist logo', errors);
  if (photos.permissionAssets !== true && photos.permissionAssets !== 'true') {
    addField(
      'photos.permissionAssets',
      'Please confirm permission to use promotional assets.'
    );
  }

  const streaming = data.streaming || {};
  for (const key of [
    'spotify',
    'appleMusic',
    'youtubeArtist',
    'youtubeMusic',
    'amazonMusic',
  ]) {
    validateUrl(streaming[key], key, errors);
  }
  for (const listKey of [
    'otherStreamingLinks',
    'officialMusicVideos',
    'livePerformanceVideos',
    'otherVideoLinks',
  ]) {
    for (const url of ensureArray(streaming[listKey])) {
      validateUrl(url, listKey, errors);
    }
  }

  validateUrl(social.facebook, 'Facebook', errors, { required: true });
  validateUrl(social.instagram, 'Instagram', errors, { required: true });
  validateUrl(social.tiktok, 'TikTok', errors);
  validateUrl(social.youtube, 'YouTube', errors);
  for (const url of ensureArray(social.otherSocialProfiles)) {
    validateUrl(url, 'Other social profile', errors);
  }

  const live = data.live || {};
  if (
    !['Yes', 'No', 'Limited', 'Need to Discuss'].includes(
      asString(live.availableForBooking)
    )
  ) {
    addField(
      'live.availableForBooking',
      'Please select booking availability.'
    );
  }
  if (!ensureArray(live.showTypes).length) {
    addField('live.showTypes', 'Select at least one show type.');
  }
  if (isBlank(live.travelArea)) {
    addField('live.travelArea', 'Travel area is required.');
  }

  validateEmail(contact.preferredEmail, 'Preferred artist email', errors, {
    required: true,
  });
  if (
    contact.preferredPhone &&
    !/^[\d+\-\s().]{7,}$/.test(asString(contact.preferredPhone))
  ) {
    addField('contact.preferredPhone', 'Phone number looks invalid.');
  }
  if (
    !['Email', 'Phone', 'Text', 'TAIG'].includes(
      asString(contact.preferredContactMethod)
    )
  ) {
    addField(
      'contact.preferredContactMethod',
      'Preferred contact method is required.'
    );
  }
  if (
    ![
      'TAIG handles public inquiries',
      'Show my artist email',
      'Discuss with me first',
    ].includes(asString(contact.publicContactPreference))
  ) {
    addField(
      'contact.publicContactPreference',
      'Public contact preference is required.'
    );
  }
  if (
    contact.accuracyConfirmation !== true &&
    contact.accuracyConfirmation !== 'true'
  ) {
    addField(
      'contact.accuracyConfirmation',
      'Please confirm your answers are accurate.'
    );
  }
  if (contact.usePermission !== true && contact.usePermission !== 'true') {
    addField(
      'contact.usePermission',
      'Please confirm you understand TAIG will review before public use.'
    );
  }

  // Radio/press URL validation inside repeatable entries
  for (const entry of ensureArray(data.proof?.radioAirplay)) {
    validateUrl(entry?.evidenceUrl, 'Radio evidence URL', errors);
  }
  for (const entry of ensureArray(data.proof?.pressItems)) {
    validateUrl(entry?.url, 'Press URL', errors);
  }
  for (const entry of ensureArray(data.proof?.pressQuotes)) {
    validateUrl(entry?.url, 'Press quote URL', errors);
  }

  return {
    ok: errors.length === 0,
    errors,
    fieldErrors,
    artistName: asString(artist.artistName) || 'Jay Garrett',
  };
}

export { URL_RE, EMAIL_RE };
