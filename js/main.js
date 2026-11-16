// =========================================================
// Chess Club at CSUSB - Front-end behavior
// 1) Mobile menu  2) Active link while scrolling
// 3) Event filter  4) Join form validation + AJAX submit
// =========================================================

document.addEventListener('DOMContentLoaded', () => {

  // ---------- 1) Mobile menu ----------
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('main-nav');

  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });

  // Close the menu after a link is chosen (on phones)
  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });

  // ---------- 2) Highlight the section that is on screen ----------
  const links = nav.querySelectorAll('a:not(.btn)');
  const sections = [...links].map(a => document.querySelector(a.getAttribute('href')));

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id));
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(sec => sec && observer.observe(sec));

  // "Back to top" button appears after scrolling down
  const toTop = document.querySelector('.to-top');
  window.addEventListener('scroll', () => {
    toTop.classList.toggle('show', window.scrollY > 600);
  }, { passive: true });

  // ---------- 3) Event type filter ----------
  // Hide events whose date has passed (useful on the static version of the site)
  const today = new Date().toISOString().slice(0, 10);
  document.querySelectorAll('.event[data-date]').forEach(ev => {
    if (ev.dataset.date < today) ev.remove();
  });
  const eventsList = document.querySelector('.events-list');
  if (eventsList && !eventsList.querySelector('.event')) {
    eventsList.outerHTML = '<p class="notice">No upcoming events yet. New dates will be posted soon.</p>';
    document.querySelector('.filter-bar')?.remove();
  }

  const chips = document.querySelectorAll('.chip');
  const events = document.querySelectorAll('.event');

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const type = chip.dataset.filter;
      events.forEach(ev => {
        ev.hidden = !(type === 'all' || ev.dataset.type === type);
      });
    });
  });

  // ---------- 5) Chess.com club info (Published-Data API, no key needed) ----------
  const clubBox = document.getElementById('chesscom-club');
  if (clubBox) {
    const clubId = clubBox.dataset.club;
    const api = 'https://api.chess.com/pub/club/' + clubId;

    fetch(api)
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(club => {
        if (club.name) document.getElementById('cc-name').textContent = club.name;
        if (club.members_count) {
          const n = club.members_count;
          document.getElementById('cc-members').textContent = n + (n === 1 ? ' member' : ' members');
        }
      })
      .catch(() => { /* keep the default text if Chess.com is unavailable */ });

    fetch(api + '/members')
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(data => {
        const members = [...(data.weekly || []), ...(data.monthly || []), ...(data.all_time || [])];
        if (!members.length) return;
        const list = document.querySelector('#cc-member-list ul');
        members.slice(0, 24).forEach(m => {
          const li = document.createElement('li');
          const a = document.createElement('a');
          a.href = 'https://www.chess.com/member/' + encodeURIComponent(m.username);
          a.target = '_blank';
          a.rel = 'noopener';
          a.textContent = m.username;
          li.appendChild(a);
          list.appendChild(li);
        });
        document.getElementById('cc-member-list').hidden = false;
      })
      .catch(() => { /* member list stays hidden */ });
  }

  // ---------- 4) Join form ----------
  const form = document.getElementById('join-form');
  if (!form) return;

  const status = document.getElementById('form-status');
  const message = document.getElementById('message');
  const counter = document.getElementById('msg-count');
  const submitBtn = form.querySelector('button[type="submit"]');

  // Character counter for the optional message
  message.addEventListener('input', () => {
    counter.textContent = message.value.length;
  });

  // Validation rules (the server checks the same rules again)
  const rules = {
    full_name: value => value.trim().length >= 2 || 'Please enter your full name.',
    email: value => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()) || 'Please enter a valid email address.',
    skill_level: value => value !== '' || 'Please choose your experience level.',
    preferred_game: value => value !== '' || 'Please choose a preferred game.'
  };

  function showError(name, text) {
    const input = form.elements[name];
    const field = input.closest('.field');
    const error = field.querySelector('.error');
    field.classList.toggle('invalid', Boolean(text));
    field.classList.toggle('valid', !text);
    if (error) error.textContent = text || '';
  }

  function validateField(name) {
    const result = rules[name](form.elements[name].value);
    showError(name, result === true ? '' : result);
    return result === true;
  }

  // Check each field when the user leaves it, and again while typing if it was wrong
  Object.keys(rules).forEach(name => {
    const input = form.elements[name];
    input.addEventListener('blur', () => validateField(name));
    input.addEventListener('input', () => {
      if (input.closest('.field').classList.contains('invalid')) validateField(name);
    });
    input.addEventListener('change', () => validateField(name));
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    status.className = 'form-status';
    status.textContent = '';

    const allValid = Object.keys(rules).map(validateField).every(Boolean);
    if (!allValid) {
      status.classList.add('fail');
      status.textContent = 'Please fix the highlighted fields.';
      form.querySelector('.field.invalid input, .field.invalid select')?.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      });
      const data = await response.json();

      // The PHP version returns {ok, message, errors}; the live site uses Formspree
      const isFormspree = form.action.includes('formspree.io');
      const ok = isFormspree ? response.ok : data.ok;
      let text = data.message;
      if (isFormspree) {
        const firstName = form.elements.full_name.value.trim().split(' ')[0];
        text = ok
          ? `Thanks, ${firstName}! Your membership request was received. An officer will email you soon.`
          : (data.errors || []).map(e => e.message).join(' ') || 'Something went wrong. Please try again.';
      } else if (data.errors) {
        Object.entries(data.errors).forEach(([name, msg]) => form.elements[name] && showError(name, msg));
      }
      status.classList.add(ok ? 'success' : 'fail');
      status.textContent = text;

      if (ok) {
        form.reset();
        counter.textContent = '0';
        form.querySelectorAll('.field').forEach(f => f.classList.remove('valid', 'invalid'));
      }
    } catch (err) {
      status.classList.add('fail');
      status.textContent = 'Something went wrong. Please try again or email info@coyotechessclub.org.';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Membership Request';
    }
  });
});
