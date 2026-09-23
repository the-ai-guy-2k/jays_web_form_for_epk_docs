(() => {
  const appEl = document.getElementById('app');
  const progressText = document.getElementById('progress-text');
  const progressPct = document.getElementById('progress-pct');
  const progressFill = document.getElementById('progress-fill');
  const progressBar = document.querySelector('.progress-bar');

  const sections = window.EPK_SCHEMA.sections;
  const TOTAL_STEPS = sections.length + 1; // + review

  const state = {
    step: 0, // 0..sections.length-1 form, sections.length = review, success after submit
    known: {},
    data: {},
    errors: {},
    submitting: false,
    result: null,
    intakeToken: '',
  };

  function intakeTokenFromPath() {
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts[0] === 'i' && parts[1]) return parts[1];
    return '';
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

  function updateProgress() {
    const idx = Math.min(state.step, sections.length);
    const human = Math.min(idx + 1, TOTAL_STEPS);
    const label =
      idx < sections.length
        ? `Section ${human} of ${sections.length}`
        : 'Review';
    const pct = Math.round((idx / sections.length) * 100);
    progressText.textContent = label;
    progressPct.textContent = `${pct}%`;
    progressFill.style.width = `${pct}%`;
    progressBar.setAttribute('aria-valuenow', String(pct));
  }

  function collectCurrentSection() {
    if (state.step >= sections.length) return;
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
          `<div class="repeat-block"><input type="${inputType}" data-index="${i}" placeholder="${field.type === 'tracklist' ? `Song ${i + 1}` : field.itemLabel || 'Item'}" value="${escapeHtml(v)}" /></div>`
      );
      return `<div class="field${errClass}" data-repeat="${field.key}">${label}${prompt}${hint}${rows.join('')}
        <div class="repeat-actions">
          <button type="button" class="btn btn-ghost" data-add="${field.key}">Add another</button>
          <button type="button" class="btn btn-ghost" data-remove="${field.key}">Remove last</button>
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

    appEl.innerHTML = `<section class="card" data-section="${section.id}">
      <h2 class="section-title">${escapeHtml(section.title)}</h2>
      <p class="section-help">${escapeHtml(section.help || '')}</p>
      ${context}
      <form id="section-form" novalidate>${fieldsHtml}
        <div class="nav">
          <button type="button" class="btn btn-secondary" id="btn-back" ${isFirst ? 'disabled' : ''}>Back</button>
          <span class="spacer"></span>
          <button type="submit" class="btn btn-primary" id="btn-next">${isLast ? 'Review' : 'Next'}</button>
        </div>
      </form>
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

  function renderReview() {
    const blocks = sections
      .map((section) => {
        const rows = section.fields
          .map((field) => {
            const shown = displayValue(field, state.data[section.id][field.key]);
            const body = shown
              ? `<div class="review-value">${escapeHtml(shown).replace(/\n/g, '<br>')}</div>`
              : `<div class="review-value review-empty">${field.optional ? 'Not provided (optional)' : 'Not answered'}</div>`;
            return `<div class="review-row"><div class="review-label">${escapeHtml(field.label)}</div>${body}</div>`;
          })
          .join('');
        return `<div class="review-section"><h3>${escapeHtml(section.title)}</h3>${rows}
          <button type="button" class="btn btn-ghost" data-edit="${section.id}">Edit this section</button>
        </div>`;
      })
      .join('');

    appEl.innerHTML = `<section class="card">
      <h2 class="section-title">Review</h2>
      <p class="section-help">Check your answers before submitting. You can go back and edit any section.</p>
      <div id="review-errors"></div>
      ${blocks}
      <div class="nav">
        <button type="button" class="btn btn-secondary" id="btn-back">Back</button>
        <span class="spacer"></span>
        <button type="button" class="btn btn-primary" id="btn-submit">Submit Intake</button>
      </div>
    </section>`;

    updateProgress();
    document.getElementById('btn-back').onclick = () => {
      state.step = sections.length - 1;
      render();
    };
    document.getElementById('btn-submit').onclick = submitAll;
    appEl.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-edit');
        state.step = sections.findIndex((s) => s.id === id);
        render();
      });
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderSuccess() {
    const r = state.result;
    appEl.innerHTML = `<section class="card success">
      <h2>Thank you</h2>
      <p>${escapeHtml(r.message)}</p>
      <p>Reference: <span class="mono">${escapeHtml(r.submissionId)}</span></p>
      <p>Received: <span class="mono">${escapeHtml(r.submittedAt)}</span></p>
    </section>`;
    progressText.textContent = 'Submitted';
    progressPct.textContent = '100%';
    progressFill.style.width = '100%';
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
      state.step += 1;
      render();
    });
    document.getElementById('btn-back').onclick = () => {
      collectCurrentSection();
      state.errors = {};
      state.step = Math.max(0, state.step - 1);
      render();
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
          intakeToken: state.intakeToken,
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
      renderSuccess();
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
    if (state.result) {
      renderSuccess();
      return;
    }
    if (state.step >= sections.length) {
      renderReview();
      return;
    }
    renderSection();
  }

  async function boot() {
    state.intakeToken = intakeTokenFromPath();
    if (!state.intakeToken) {
      appEl.innerHTML =
        '<section class="card"><p>This page needs a valid intake link.</p></section>';
      return;
    }
    initData();
    try {
      const res = await fetch(
        `/api/bootstrap?token=${encodeURIComponent(state.intakeToken)}`
      );
      if (!res.ok) throw new Error('bad token');
      const body = await res.json();
      state.known = body.known || {};
      // Apply known prefills where schema already has defaults; ensure consistency
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
        '<section class="card"><p>This intake link is not valid.</p></section>';
      return;
    }
    render();
  }

  boot();
})();
