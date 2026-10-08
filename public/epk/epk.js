(function () {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  if (toggle && nav) {
    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
    };
    toggle.addEventListener('click', () => {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  document.querySelectorAll('.js-print').forEach((button) => {
    button.addEventListener('click', () => window.print());
  });

  const players = [...document.querySelectorAll('audio.epk-player')];
  players.forEach((player) => {
    player.removeAttribute('autoplay');
    player.addEventListener('play', () => {
      players.forEach((other) => {
        if (other !== player && !other.paused) other.pause();
      });
    });
  });

  const dialog = document.getElementById('download-dialog');
  const form = document.getElementById('download-form');
  const passwordInput = document.getElementById('download-password');
  const errorEl = document.getElementById('download-error');
  const trackNameEl = document.getElementById('download-track-name');
  const submitBtn = document.getElementById('download-submit');
  let activeTrackId = '';
  let lastTrigger = null;

  function setError(message) {
    if (!errorEl) return;
    if (message) {
      errorEl.hidden = false;
      errorEl.textContent = message;
      passwordInput?.setAttribute('aria-invalid', 'true');
    } else {
      errorEl.hidden = true;
      errorEl.textContent = '';
      passwordInput?.removeAttribute('aria-invalid');
    }
  }

  function closeDialog() {
    if (!dialog?.open) return;
    dialog.close();
    setError('');
    if (form) form.reset();
    if (lastTrigger) lastTrigger.focus();
  }

  function openDialog(trackId, title, trigger) {
    activeTrackId = trackId;
    lastTrigger = trigger;
    if (trackNameEl) trackNameEl.textContent = title;
    setError('');
    if (form) form.reset();
    dialog?.showModal();
    passwordInput?.focus();
  }

  document.querySelectorAll('.js-download').forEach((button) => {
    button.addEventListener('click', () => {
      openDialog(button.dataset.trackId, button.dataset.trackTitle, button);
    });
  });

  document.querySelectorAll('.js-download-cancel').forEach((button) => {
    button.addEventListener('click', () => closeDialog());
  });

  dialog?.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeDialog();
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!activeTrackId || !passwordInput) return;
    submitBtn.disabled = true;
    setError('');
    try {
      const res = await fetch('/api/epk/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackId: activeTrackId,
          password: passwordInput.value,
        }),
      });
      if (!res.ok) {
        let message = 'Incorrect download password.';
        try {
          const body = await res.json();
          if (body?.error) message = body.error;
        } catch {
          /* keep default */
        }
        setError(message);
        passwordInput.focus();
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : 'Jay-Garrett-featured-track.wav';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      closeDialog();
    } catch {
      setError('The download could not be completed. Please try again.');
    } finally {
      submitBtn.disabled = false;
    }
  });
})();
