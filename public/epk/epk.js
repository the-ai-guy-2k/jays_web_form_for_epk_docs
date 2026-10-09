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
})();
