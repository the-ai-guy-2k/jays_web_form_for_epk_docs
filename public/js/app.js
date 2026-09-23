(() => {
  const appEl = document.getElementById('app');
  const progressText = document.getElementById('progress-text');
  const progressPct = document.getElementById('progress-pct');
  const progressFill = document.getElementById('progress-fill');
  const progressBar = document.querySelector('.progress-bar');
  const draftBanner = document.getElementById('draft-banner');
  const shellEl = document.getElementById('shell');
  const introPanel = document.getElementById('intro-panel');
  const sidebarNav = document.getElementById('sidebar-nav');

  const sections = window.EPK_SCHEMA.sections;
  const SECTION_ICONS = {
    artist: '👤',
    bio: '📄',
    album: '💿',
    featured: '🎵',
    photos: '📷',
    streaming: '▶️',
    social: '🔗',
    proof: '🎙️',
    live: '📅',
    contact: '✅',
  };

  const state = {
    view: 'form', // form | review | success
    step: 0,
    known: {},
    data: {},
    errors: {},
    submitting: false,
    saving: false,
    result: null,
    resumeToken: '',
  };

  function draftTokenFromQuery() {
    return new URLSearchParams(location.search).get('draft') || '';
  }

  function showDraftBanner(html, { hidden = false } = {}) {
    if (!draftBanner) return;
    if (hidden) {
      draftBanner.hidden = true;
      draftBanner.innerHTML = '';
      return;
    }
    draftBanner.hidden = false;
    draftBanner.innerHTML = html;
  }

  function mergeLoadedSections(saved) {
    if (!saved || typeof saved !== 'object') return;
    for (const section of sections) {
      if (!saved[section.id]) continue;
      state.data[section.id] = {
        ...state.data[section.id],
        ...saved[section.id],
      };
    }
  }

  function emptyForType(type, field) {
    switch (type) {
      case 'repeat-text':
      case 'repeat-url':
        return [''];
      case 'tracklist':
        return Array.from({ length: field.defaultCount || 12 }, () => '');
      case 'repeat-name-role':
        return [{ name: '', role: '' }];
      case 'repeat-song-writer':
        return [{ song: '', writers: '' }];
      case 'repeat-photo-credit':
        return [{ photo: '', photographer: '' }];
      case 'repeat-radio':
        return [
          {
            station: '',
            song: '',
            timeframe: '',
            notes: '',
            evidenceUrl: '',
          },
        ];
      case 'repeat-press':
        return [
          {
            outlet: '',
            type: '',
            date: '',
            url: '',
            notes: '',
          },
        ];
      case 'repeat-quote':
        return [{ quote: '', source: '', url: '' }];
      case 'checkbox-group':
        return [];
      case 'checkbox-required':
        return false;
      case 'number':
        return field.prefill ?? '';
      default:
        return field.prefill ?? '';
    }
  }

  function initData() {
    for (const section of sections) {
      state.data[section.id] = {};
      for (const field of section.fields) {
        state.data[section.id][field.key] = emptyForType(field.type, field);
      }
    }
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isBlank(v) {
    return v === undefined || v === null || String(v).trim() === '';
  }

  function isValidUrl(v) {
    if (isBlank(v)) return true;
    try {
      const u = new URL(String(v).trim());
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }

  function isValidEmail(v) {
    if (isBlank(v)) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());
  }

  function updateShell() {
    if (!shellEl) return;
    shellEl.classList.remove(
      'shell-form',
      'shell-review',
      'shell-success'
    );
    shellEl.classList.add(`shell-${state.view}`);
    if (introPanel) {
      introPanel.hidden = state.view !== 'form' && state.view !== 'review';
    }
    renderSidebar();
  }

  function renderSidebar() {
    if (!sidebarNav) return;
    sidebarNav.innerHTML = sections
      .map((section, idx) => {
        const active =
          state.view === 'form' && state.step === idx ? ' active' : '';
        const icon = SECTION_ICONS[section.id] || '•';
        return `<button type="button" data-goto="${idx}" class="${active.trim()}"><span aria-hidden="true">${icon}</span> ${idx + 1}. ${escapeHtml(section.title)}</button>`;
      })
      .join('');
    if (state.view === 'review') {
      sidebarNav.insertAdjacentHTML(
        'beforeend',
        `<button type="button" data-goto="review" class="active">Review</button>`
      );
    }
    sidebarNav.querySelectorAll('[data-goto]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-goto');
        if (state.view === 'form') collectCurrentSection();
        if (target === 'review') {
          // only allow review jump if all required on current path — soft allow for UX after visiting
          state.view = 'review';
          render();
          return;
        }
        state.view = 'form';
        state.step = Number(target);
        state.errors = {};
        render();
      });
    });
  }

  function updateProgress() {
    if (state.view === 'success') return;
    const idx = state.view === 'review' ? sections.length : state.step;
    const human =
      state.view === 'review'
        ? 'Review'
        : `Section ${state.step + 1} of ${sections.length}`;
    const pct = Math.round((idx / sections.length) * 100);
    progressText.textContent = human;
    progressPct.textContent = `${pct}%`;
    progressFill.style.width = `${pct}%`;
    progressBar.setAttribute('aria-valuenow', String(pct));
  }

  function collectCurrentSection() {
    if (state.view !== 'form') return;
    const section = sections[state.step];
    const root = appEl.querySelector(`[data-section="${section.id}"]`);
    if (!root) return;
    const next = { ...state.data[section.id] };

    for (const field of section.fields) {
      const type = field.type;
      if (type === 'checkbox-group') {
        next[field.key] = Array.from(
          root.querySelectorAll(`input[name="${field.key}"]:checked`)
        ).map((el) => el.value);
      } else if (type === 'checkbox-required') {
        const el = root.querySelector(`input[name="${field.key}"]`);
        next[field.key] = !!(el && el.checked);
      } else if (type === 'radio') {
        const el = root.querySelector(`input[name="${field.key}"]:checked`);
        next[field.key] = el ? el.value : '';
      } else if (type === 'repeat-text' || type === 'repeat-url' || type === 'tracklist') {
        next[field.key] = Array.from(
          root.querySelectorAll(`[data-repeat="${field.key}"] input`)
        ).map((el) => el.value);
      } else if (type === 'repeat-name-role') {
        next[field.key] = Array.from(
          root.querySelectorAll(`[data-repeat="${field.key}"] .repeat-block`)
        ).map((block) => ({
          name: block.querySelector('[data-part="name"]').value,
          role: block.querySelector('[data-part="role"]').value,
        }));
      } else if (type === 'repeat-song-writer') {
        next[field.key] = Array.from(
          root.querySelectorAll(`[data-repeat="${field.key}"] .repeat-block`)
        ).map((block) => ({
          song: block.querySelector('[data-part="song"]').value,
          writers: block.querySelector('[data-part="writers"]').value,
        }));
      } else if (type === 'repeat-photo-credit') {
        next[field.key] = Array.from(
          root.querySelectorAll(`[data-repeat="${field.key}"] .repeat-block`)
        ).map((block) => ({
          photo: block.querySelector('[data-part="photo"]').value,
          photographer: block.querySelector('[data-part="photographer"]').value,
        }));
      } else if (type === 'repeat-radio') {
        next[field.key] = Array.from(
          root.querySelectorAll(`[data-repeat="${field.key}"] .repeat-block`)
        ).map((block) => ({
          station: block.querySelector('[data-part="station"]').value,
          song: block.querySelector('[data-part="song"]').value,
          timeframe: block.querySelector('[data-part="timeframe"]').value,
          notes: block.querySelector('[data-part="notes"]').value,
          evidenceUrl: block.querySelector('[data-part="evidenceUrl"]').value,
        }));
      } else if (type === 'repeat-press') {
        next[field.key] = Array.from(
          root.querySelectorAll(`[data-repeat="${field.key}"] .repeat-block`)
        ).map((block) => ({
          outlet: block.querySelector('[data-part="outlet"]').value,
          type: block.querySelector('[data-part="type"]').value,
          date: block.querySelector('[data-part="date"]').value,
          url: block.querySelector('[data-part="url"]').value,
          notes: block.querySelector('[data-part="notes"]').value,
        }));
      } else if (type === 'repeat-quote') {
        next[field.key] = Array.from(
          root.querySelectorAll(`[data-repeat="${field.key}"] .repeat-block`)
        ).map((block) => ({
          quote: block.querySelector('[data-part="quote"]').value,
          source: block.querySelector('[data-part="source"]').value,
          url: block.querySelector('[data-part="url"]').value,
        }));
      } else {
        const el = root.querySelector(`[name="${field.key}"]`);
        if (!el) continue;
        next[field.key] =
          field.type === 'number' && el.value !== ''
            ? Number(el.value)
            : el.value;
      }
    }
    state.data[section.id] = next;
  }

  function validateSection(sectionIndex) {
    const section = sections[sectionIndex];
    const data = state.data[section.id];
    const fieldErrors = {};

    for (const field of section.fields) {
      const value = data[field.key];
      const msgs = [];

      if (field.required && !field.optional) {
        if (field.type === 'checkbox-required' && value !== true) {
          msgs.push('Please confirm this item.');
        } else if (field.type === 'checkbox-group') {
          if (!Array.isArray(value) || !value.length) {
            msgs.push('Select at least one option.');
          }
        } else if (field.type === 'tracklist') {
          const filled = (value || []).filter((t) => !isBlank(t));
          if (!filled.length) msgs.push('Add at least one song title.');
        } else if (field.type === 'radio' || field.type === 'select') {
          if (isBlank(value)) msgs.push('Please make a selection.');
        } else if (typeof value === 'string' || typeof value === 'number') {
          if (isBlank(value) && value !== 0) msgs.push('This field is required.');
        }
      }

      if (field.type === 'url' || field.type === 'email' || field.type === 'tel') {
        if (field.type === 'url' && !isValidUrl(value)) {
          msgs.push('Enter a valid http:// or https:// link.');
        }
        if (field.type === 'email' && !isValidEmail(value)) {
          msgs.push('Enter a valid email address.');
        }
        if (
          field.type === 'tel' &&
          !isBlank(value) &&
          !/^[\d+\-\s().]{7,}$/.test(String(value))
        ) {
          msgs.push('Enter a valid phone number.');
        }
      }

      if (field.type === 'repeat-url') {
        for (const url of value || []) {
          if (!isBlank(url) && !isValidUrl(url)) {
            msgs.push('One or more links are not valid.');
            break;
          }
        }
      }

      if (msgs.length) fieldErrors[field.key] = msgs;
    }

    state.errors = fieldErrors;
    return Object.keys(fieldErrors).length === 0;
  }

  function renderInput(field, value, error) {
    const optional = field.optional
      ? '<span class="optional-tag">Optional</span>'
      : '';
    const hint = field.hint
      ? `<span class="hint">${escapeHtml(field.hint)}</span>`
      : '';
    const prompt = field.prompt
      ? `<span class="hint">${escapeHtml(field.prompt)}</span>`
      : '';
    const err = error
      ? `<div class="field-error">${escapeHtml(error.join(' '))}</div>`
      : '';
    const errClass = error ? ' has-error' : '';
    const label = `<label for="${field.key}">${escapeHtml(field.label)}${optional}</label>`;

    if (field.type === 'checkbox-required') {
      return `<div class="field${errClass}">
        <label class="choice"><input type="checkbox" name="${field.key}" id="${field.key}" ${value ? 'checked' : ''} /> <span>${escapeHtml(field.label)}</span></label>
        ${err}
      </div>`;
    }

    if (field.type === 'radio') {
      const opts = (field.options || [])
        .map(
          (opt) =>
            `<label class="choice"><input type="radio" name="${field.key}" value="${escapeHtml(opt)}" ${value === opt ? 'checked' : ''} /> <span>${escapeHtml(opt)}</span></label>`
        )
        .join('');
      return `<div class="field${errClass}">${label}${prompt}${hint}<div class="choice-row">${opts}</div>${err}</div>`;
    }

    if (field.type === 'checkbox-group') {
      const selected = new Set(value || []);
      const opts = (field.options || [])
        .map(
          (opt) =>
            `<label class="choice"><input type="checkbox" name="${field.key}" value="${escapeHtml(opt)}" ${selected.has(opt) ? 'checked' : ''} /> <span>${escapeHtml(opt)}</span></label>`
        )
        .join('');
      return `<div class="field${errClass}">${label}${prompt}${hint}<div class="choice-row">${opts}</div>${err}</div>`;
    }

    if (field.type === 'select') {
      const opts = (field.options || [])
        .map(
          (opt) =>
            `<option value="${escapeHtml(opt)}" ${value === opt ? 'selected' : ''}>${escapeHtml(opt)}</option>`
        )
        .join('');
      return `<div class="field${errClass}">${label}${prompt}${hint}<select id="${field.key}" name="${field.key}"><option value="">Select…</option>${opts}</select>${err}</div>`;
    }

    if (field.type === 'textarea' || field.type === 'textarea-short') {
      const cls = field.type === 'textarea-short' ? 'short' : '';
      return `<div class="field${errClass}">${label}${prompt}${hint}<textarea class="${cls}" id="${field.key}" name="${field.key}">${escapeHtml(value)}</textarea>${err}</div>`;
    }

    if (field.type === 'repeat-text' || field.type === 'repeat-url' || field.type === 'tracklist') {
      const inputType = field.type === 'repeat-url' ? 'url' : 'text';
      const rows = (value && value.length ? value : ['']).map(
        (v, i) =>
          `<div class="repeat-block">${
            field.type === 'tracklist'
              ? `<div class="song-card-label">Track ${i + 1}</div>`
              : ''
          }<input type="${inputType}" data-index="${i}" placeholder="${field.type === 'tracklist' ? 'Song title' : field.itemLabel || 'Item'}" value="${escapeHtml(v)}" /></div>`
      );
      return `<div class="field${errClass}" data-repeat="${field.key}">${label}${prompt}${hint}${rows.join('')}
        <div class="repeat-actions">
          <button type="button" class="btn btn-ghost" data-add="${field.key}">${field.type === 'tracklist' ? 'Add Another Track' : 'Add another'}</button>
          <button type="button" class="btn btn-ghost" data-remove="${field.key}">${field.type === 'tracklist' ? 'Remove Track' : 'Remove last'}</button>
        </div>${err}</div>`;
    }

    if (field.type === 'repeat-name-role') {
      const rows = (value && value.length ? value : [{ name: '', role: '' }])
        .map(
          (v) => `<div class="repeat-block">
            <input type="text" data-part="name" placeholder="Name" value="${escapeHtml(v.name || '')}" />
            <div style="height:.45rem"></div>
            <input type="text" data-part="role" placeholder="Role" value="${escapeHtml(v.role || '')}" />
          </div>`
        )
        .join('');
      return `<div class="field${errClass}" data-repeat="${field.key}">${label}${hint}${rows}
        <div class="repeat-actions">
          <button type="button" class="btn btn-ghost" data-add="${field.key}">Add credit</button>
          <button type="button" class="btn btn-ghost" data-remove="${field.key}">Remove last</button>
        </div>${err}</div>`;
    }

    if (field.type === 'repeat-song-writer') {
      const rows = (value && value.length ? value : [{ song: '', writers: '' }])
        .map(
          (v) => `<div class="repeat-block">
            <input type="text" data-part="song" placeholder="Song title" value="${escapeHtml(v.song || '')}" />
            <div style="height:.45rem"></div>
            <input type="text" data-part="writers" placeholder="Writer / co-writer(s)" value="${escapeHtml(v.writers || '')}" />
          </div>`
        )
        .join('');
      return `<div class="field${errClass}" data-repeat="${field.key}">${label}${hint}${rows}
        <div class="repeat-actions">
          <button type="button" class="btn btn-ghost" data-add="${field.key}">Add song credit</button>
          <button type="button" class="btn btn-ghost" data-remove="${field.key}">Remove last</button>
        </div>${err}</div>`;
    }

    if (field.type === 'repeat-photo-credit') {
      const rows = (
        value && value.length ? value : [{ photo: '', photographer: '' }]
      )
        .map(
          (v) => `<div class="repeat-block">
            <input type="text" data-part="photo" placeholder="Photo description or link" value="${escapeHtml(v.photo || '')}" />
            <div style="height:.45rem"></div>
            <input type="text" data-part="photographer" placeholder="Photographer" value="${escapeHtml(v.photographer || '')}" />
          </div>`
        )
        .join('');
      return `<div class="field${errClass}" data-repeat="${field.key}">${label}${hint}${rows}
        <div class="repeat-actions">
          <button type="button" class="btn btn-ghost" data-add="${field.key}">Add credit</button>
          <button type="button" class="btn btn-ghost" data-remove="${field.key}">Remove last</button>
        </div>${err}</div>`;
    }

    if (field.type === 'repeat-radio') {
      const rows = (
        value && value.length
          ? value
          : [
              {
                station: '',
                song: '',
                timeframe: '',
                notes: '',
                evidenceUrl: '',
              },
            ]
      )
        .map(
          (v) => `<div class="repeat-block">
            <input type="text" data-part="station" placeholder="Station" value="${escapeHtml(v.station || '')}" />
            <div style="height:.45rem"></div>
            <input type="text" data-part="song" placeholder="Song" value="${escapeHtml(v.song || '')}" />
            <div style="height:.45rem"></div>
            <input type="text" data-part="timeframe" placeholder="Approximate date / timeframe" value="${escapeHtml(v.timeframe || '')}" />
            <div style="height:.45rem"></div>
            <textarea data-part="notes" class="short" placeholder="Notes">${escapeHtml(v.notes || '')}</textarea>
            <div style="height:.45rem"></div>
            <input type="url" data-part="evidenceUrl" placeholder="Evidence URL (optional)" value="${escapeHtml(v.evidenceUrl || '')}" />
          </div>`
        )
        .join('');
      return `<div class="field${errClass}" data-repeat="${field.key}">${label}${hint}${rows}
        <div class="repeat-actions">
          <button type="button" class="btn btn-ghost" data-add="${field.key}">Add airplay entry</button>
          <button type="button" class="btn btn-ghost" data-remove="${field.key}">Remove last</button>
        </div>${err}</div>`;
    }

    if (field.type === 'repeat-press') {
      const rows = (
        value && value.length
          ? value
          : [{ outlet: '', type: '', date: '', url: '', notes: '' }]
      )
        .map(
          (v) => `<div class="repeat-block">
            <input type="text" data-part="outlet" placeholder="Outlet / publication" value="${escapeHtml(v.outlet || '')}" />
            <div style="height:.45rem"></div>
            <input type="text" data-part="type" placeholder="Type (interview, review, podcast…)" value="${escapeHtml(v.type || '')}" />
            <div style="height:.45rem"></div>
            <input type="text" data-part="date" placeholder="Approximate date" value="${escapeHtml(v.date || '')}" />
            <div style="height:.45rem"></div>
            <input type="url" data-part="url" placeholder="URL" value="${escapeHtml(v.url || '')}" />
            <div style="height:.45rem"></div>
            <textarea data-part="notes" class="short" placeholder="Notes">${escapeHtml(v.notes || '')}</textarea>
          </div>`
        )
        .join('');
      return `<div class="field${errClass}" data-repeat="${field.key}">${label}${hint}${rows}
        <div class="repeat-actions">
          <button type="button" class="btn btn-ghost" data-add="${field.key}">Add press entry</button>
          <button type="button" class="btn btn-ghost" data-remove="${field.key}">Remove last</button>
        </div>${err}</div>`;
    }

    if (field.type === 'repeat-quote') {
      const rows = (
        value && value.length ? value : [{ quote: '', source: '', url: '' }]
      )
        .map(
          (v) => `<div class="repeat-block">
            <textarea data-part="quote" placeholder="Quote">${escapeHtml(v.quote || '')}</textarea>
            <div style="height:.45rem"></div>
            <input type="text" data-part="source" placeholder="Source" value="${escapeHtml(v.source || '')}" />
            <div style="height:.45rem"></div>
            <input type="url" data-part="url" placeholder="URL (optional)" value="${escapeHtml(v.url || '')}" />
          </div>`
        )
        .join('');
      return `<div class="field${errClass}" data-repeat="${field.key}">${label}${hint}${rows}
        <div class="repeat-actions">
          <button type="button" class="btn btn-ghost" data-add="${field.key}">Add quote</button>
          <button type="button" class="btn btn-ghost" data-remove="${field.key}">Remove last</button>
        </div>${err}</div>`;
    }

    const inputType =
      field.type === 'url'
        ? 'url'
        : field.type === 'email'
          ? 'email'
          : field.type === 'tel'
            ? 'tel'
            : field.type === 'number'
              ? 'number'
              : field.type === 'date'
                ? 'date'
                : 'text';
    const min =
      field.min !== undefined ? ` min="${field.min}"` : '';
    const max =
      field.max !== undefined ? ` max="${field.max}"` : '';
    return `<div class="field${errClass}">${label}${prompt}${hint}<input type="${inputType}" id="${field.key}" name="${field.key}" value="${escapeHtml(value)}"${min}${max} />${err}</div>`;
  }

  function renderSection() {
    const section = sections[state.step];
    const data = state.data[section.id];
    let context = '';
    if (section.contextKeys) {
      context = section.contextKeys
        .map((k) => state.known[k])
        .filter(Boolean)
        .map((t) => `<div class="context-note">${escapeHtml(t)}</div>`)
        .join('');
    }
    const fieldsHtml = section.fields
      .map((field) => {
        let extra = '';
        if (field.contextKey && state.known[field.contextKey]) {
          extra = `<div class="context-note">${escapeHtml(state.known[field.contextKey])}</div>`;
        }
        return (
          extra +
          renderInput(field, data[field.key], state.errors[field.key])
        );
      })
      .join('');

    const isFirst = state.step === 0;
    const isLast = state.step === sections.length - 1;
    const icon = SECTION_ICONS[section.id] || '•';
    const showMascot = ['artist', 'featured', 'album'].includes(section.id);

    appEl.innerHTML = `<section class="card" data-section="${section.id}">
      <h2 class="section-title"><span class="section-icon" aria-hidden="true">${icon}</span>${escapeHtml(section.title)}</h2>
      <p class="section-help">${escapeHtml(section.help || '')}</p>
      ${context}
      <div id="section-flash"></div>
      <form id="section-form" novalidate>${fieldsHtml}
        <div class="nav">
          <button type="button" class="btn btn-secondary" id="btn-back" ${isFirst ? 'disabled' : ''}>Back</button>
          <button type="button" class="btn btn-gold" id="btn-save">Save Progress</button>
          <span class="spacer"></span>
          <button type="submit" class="btn btn-primary" id="btn-next">${isLast ? 'Review' : 'Next'}</button>
        </div>
      </form>
      ${showMascot ? '<img class="card-mascot" src="/img/cartman.svg" alt="" width="72" height="86" />' : ''}
    </section>`;

    bindSectionEvents();
    updateProgress();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function displayValue(field, value) {
    if (field.type === 'checkbox-required') {
      return value === true ? 'Confirmed' : null;
    }
    if (field.type === 'checkbox-group') {
      return Array.isArray(value) && value.length ? value.join(', ') : null;
    }
    if (Array.isArray(value)) {
      if (!value.length) return null;
      if (typeof value[0] === 'object') {
        const lines = value
          .map((item) =>
            Object.values(item || {})
              .filter((v) => !isBlank(v))
              .join(' — ')
          )
          .filter(Boolean);
        return lines.length ? lines.join('\n') : null;
      }
      const filled = value.filter((v) => !isBlank(v));
      return filled.length ? filled.join('\n') : null;
    }
    if (isBlank(value) && value !== 0) return null;
    return String(value);
  }

  function formatReviewValue(field, value) {
    const shown = displayValue(field, value);
    if (!shown) {
      return `<div class="review-value review-empty">${field.optional ? 'Not provided (optional)' : 'Not answered'}</div>`;
    }
    if (field.type === 'url' || field.type === 'email') {
      const href =
        field.type === 'email' ? `mailto:${shown}` : shown;
      if (field.type === 'url' && /^https?:\/\//i.test(shown)) {
        return `<div class="review-value"><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(shown)}</a></div>`;
      }
    }
    if (field.type === 'repeat-url') {
      const links = String(shown)
        .split('\n')
        .map((line) => {
          if (/^https?:\/\//i.test(line)) {
            return `<a href="${escapeHtml(line)}" target="_blank" rel="noopener noreferrer">${escapeHtml(line)}</a>`;
          }
          return escapeHtml(line);
        })
        .join('<br>');
      return `<div class="review-value">${links}</div>`;
    }
    return `<div class="review-value">${escapeHtml(shown).replace(/\n/g, '<br>')}</div>`;
  }

  function renderReview() {
    const blocks = sections
      .map((section) => {
        const icon = SECTION_ICONS[section.id] || '•';
        const rows = section.fields
          .map((field) => {
            const body = formatReviewValue(
              field,
              state.data[section.id][field.key]
            );
            return `<div class="review-row"><div class="review-label">${escapeHtml(field.label)}</div>${body}</div>`;
          })
          .join('');
        return `<div class="review-section"><h3><span class="section-icon" aria-hidden="true">${icon}</span>${escapeHtml(section.title)}</h3>${rows}
          <button type="button" class="btn btn-ghost" data-edit="${section.id}">Edit this section</button>
        </div>`;
      })
      .join('');

    appEl.innerHTML = `<section class="card">
      <h2 class="section-title">Review Your Information</h2>
      <p class="section-help">Check your answers before submitting. You can go back and edit any section. Saving progress here does not submit.</p>
      <div id="review-errors"></div>
      ${blocks}
      <div class="nav">
        <button type="button" class="btn btn-secondary" id="btn-back">Back</button>
        <button type="button" class="btn btn-gold" id="btn-save">Save Progress</button>
        <span class="spacer"></span>
        <button type="button" class="btn btn-primary" id="btn-submit">Submit Intake</button>
      </div>
    </section>`;

    updateProgress();
    document.getElementById('btn-back').onclick = () => {
      state.view = 'form';
      state.step = sections.length - 1;
      render();
    };
    document.getElementById('btn-save').onclick = () => saveDraft();
    document.getElementById('btn-submit').onclick = submitAll;
    appEl.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-edit');
        state.view = 'form';
        state.step = sections.findIndex((s) => s.id === id);
        render();
      });
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderSuccess() {
    const r = state.result;
    state.view = 'success';
    updateShell();
    appEl.innerHTML = `<section class="card success-screen">
      <img src="/img/cartman-celebrate.svg" alt="" width="140" height="153" />
      <h2>Thank You!</h2>
      <p class="lead">Your EPK information has been submitted.</p>
      <p>${escapeHtml(r.message)}</p>
      <p><strong>Submission ID:</strong> <span class="mono">${escapeHtml(r.submissionId)}</span></p>
      <p><strong>Submitted:</strong> <span class="mono">${escapeHtml(r.submittedAt)}</span></p>
      <p>TAIG Promotions will review this information before using it in your Electronic Press Kit or promotional materials.</p>
      <div class="nav" style="justify-content:center;margin-top:1.25rem">
        <button type="button" class="btn btn-secondary" id="btn-home">Start a New Intake</button>
      </div>
    </section>`;
    document.getElementById('btn-home').onclick = () => {
      state.result = null;
      initData();
      state.view = 'form';
      state.step = 0;
      state.resumeToken = '';
      const url = new URL(location.href);
      url.searchParams.delete('draft');
      history.replaceState({}, '', url.toString());
      showDraftBanner('', { hidden: true });
      render();
    };
  }

  function bindSectionEvents() {
    const form = document.getElementById('section-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      collectCurrentSection();
      if (!validateSection(state.step)) {
        renderSection();
        const firstErr = appEl.querySelector('.has-error');
        if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (state.step >= sections.length - 1) {
        state.view = 'review';
      } else {
        state.view = 'form';
        state.step += 1;
      }
      render();
    });
    document.getElementById('btn-back').onclick = () => {
      collectCurrentSection();
      state.errors = {};
      state.view = 'form';
      state.step = Math.max(0, state.step - 1);
      render();
    };
    document.getElementById('btn-save').onclick = () => {
      collectCurrentSection();
      saveDraft();
    };

    appEl.querySelectorAll('[data-add]').forEach((btn) => {
      btn.addEventListener('click', () => {
        collectCurrentSection();
        const key = btn.getAttribute('data-add');
        const section = sections[state.step];
        const field = section.fields.find((f) => f.key === key);
        const list = state.data[section.id][key];
        if (field.type === 'repeat-text' || field.type === 'repeat-url' || field.type === 'tracklist') {
          list.push('');
        } else if (field.type === 'repeat-name-role') {
          list.push({ name: '', role: '' });
        } else if (field.type === 'repeat-song-writer') {
          list.push({ song: '', writers: '' });
        } else if (field.type === 'repeat-photo-credit') {
          list.push({ photo: '', photographer: '' });
        } else if (field.type === 'repeat-radio') {
          list.push({
            station: '',
            song: '',
            timeframe: '',
            notes: '',
            evidenceUrl: '',
          });
        } else if (field.type === 'repeat-press') {
          list.push({ outlet: '', type: '', date: '', url: '', notes: '' });
        } else if (field.type === 'repeat-quote') {
          list.push({ quote: '', source: '', url: '' });
        }
        renderSection();
      });
    });

    appEl.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        collectCurrentSection();
        const key = btn.getAttribute('data-remove');
        const section = sections[state.step];
        const list = state.data[section.id][key];
        if (Array.isArray(list) && list.length > 1) list.pop();
        renderSection();
      });
    });
  }

  async function saveDraft() {
    if (state.saving || state.result) return;
    state.saving = true;
    const saveBtn = document.getElementById('btn-save');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
    }
    try {
      const res = await fetch('/api/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeToken: state.resumeToken || undefined,
          currentStep:
            state.view === 'review' ? sections.length : state.step,
          sections: state.data,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        const flash =
          document.getElementById('section-flash') ||
          document.getElementById('review-errors');
        if (flash) {
          flash.innerHTML = `<div class="error-box">${escapeHtml(body.error || 'Could not save.')}</div>`;
        }
        return;
      }
      state.resumeToken = body.resumeToken;
      const resumeUrl = `${location.origin}${body.resumePath}`;
      const url = new URL(location.href);
      url.searchParams.set('draft', body.resumeToken);
      history.replaceState({}, '', url.toString());
      showDraftBanner(
        `<strong>Progress saved</strong> — this is not your final submission.<br>
         Bookmark or copy your resume link so you can come back later:
         <div class="resume-box"><a href="${escapeHtml(resumeUrl)}">${escapeHtml(resumeUrl)}</a></div>`
      );
      const flash =
        document.getElementById('section-flash') ||
        document.getElementById('review-errors');
      if (flash) {
        flash.innerHTML = `<div class="success-box">${escapeHtml(body.message)}</div>`;
      }
    } catch {
      const flash =
        document.getElementById('section-flash') ||
        document.getElementById('review-errors');
      if (flash) {
        flash.innerHTML =
          '<div class="error-box">Could not reach the server to save. Please try again.</div>';
      }
    } finally {
      state.saving = false;
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Progress';
      }
    }
  }

  async function submitAll() {
    if (state.submitting) return;
    // Re-validate all sections client-side
    for (let i = 0; i < sections.length; i++) {
      if (!validateSection(i)) {
        state.step = i;
        render();
        return;
      }
    }
    state.errors = {};
    state.submitting = true;
    const btn = document.getElementById('btn-submit');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Submitting…';
    }
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeToken: state.resumeToken || undefined,
          formVersion: window.EPK_SCHEMA.formVersion,
          sections: state.data,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        const box = document.getElementById('review-errors');
        if (box) {
          box.innerHTML = `<div class="error-box">${escapeHtml(
            (body.errors && body.errors.join(' ')) ||
              body.error ||
              'Submission failed.'
          )}</div>`;
        }
        state.submitting = false;
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Submit Intake';
        }
        return;
      }
      state.result = body;
      state.submitting = false;
      showDraftBanner('', { hidden: true });
      state.view = 'success';
      render();
    } catch (err) {
      const box = document.getElementById('review-errors');
      if (box) {
        box.innerHTML =
          '<div class="error-box">We could not reach the server. Please try again. Nothing was published.</div>';
      }
      state.submitting = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Submit Intake';
      }
    }
  }

  function render() {
    updateShell();
    if (state.view === 'success' || state.result) {
      renderSuccess();
      return;
    }
    if (state.view === 'review') {
      renderReview();
      return;
    }
    renderSection();
  }

  async function boot() {
    initData();
    try {
      const res = await fetch('/api/bootstrap');
      if (!res.ok) throw new Error('bootstrap failed');
      const body = await res.json();
      state.known = body.known || {};
      if (state.known.artistName) {
        state.data.artist.artistName = state.known.artistName;
      }
      if (state.known.genre) state.data.artist.genre = state.known.genre;
      if (state.known.releaseDate) {
        state.data.album.releaseDate = state.known.releaseDate;
      }
      if (state.known.trackCount) {
        state.data.album.trackCount = state.known.trackCount;
      }
      if (state.known.featuredSong1) {
        state.data.featured.featuredSong1 = state.known.featuredSong1;
      }
      if (state.known.featuredSong2) {
        state.data.featured.featuredSong2 = state.known.featuredSong2;
      }
    } catch {
      appEl.innerHTML =
        '<section class="card"><p>Could not load the intake. Please refresh and try again.</p></section>';
      return;
    }

    const draftToken = draftTokenFromQuery();
    if (draftToken) {
      try {
        const dres = await fetch(`/api/draft/${encodeURIComponent(draftToken)}`);
        const dbody = await dres.json();
        if (dres.ok) {
          state.resumeToken = dbody.resumeToken;
          mergeLoadedSections(dbody.sections);
          const step = Number(dbody.currentStep || 0);
          if (step >= sections.length) {
            state.view = 'review';
          } else {
            state.view = 'form';
            state.step = Math.min(step, sections.length - 1);
          }
          showDraftBanner(
            `<strong>Welcome back.</strong> Your saved answers were restored. Continue where you left off, or save again anytime.`
          );
        } else if (dres.status === 409) {
          appEl.innerHTML = `<section class="card"><p>${escapeHtml(dbody.error || 'Already submitted.')}</p></section>`;
          return;
        } else {
          state.view = 'form';
          showDraftBanner(
            `Could not load that saved link. You can still fill out a new form and save progress.`
          );
        }
      } catch {
        state.view = 'form';
        showDraftBanner(
          `Could not load saved progress right now. You can still continue with a new form.`
        );
      }
    } else {
      state.view = 'form';
    }

    render();
  }

  boot();
})();
