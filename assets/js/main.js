/* =========================================================
   FINVERA — interactions & micro-animations
   ========================================================= */
(function () {
  'use strict';
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Preloader ---------- */
  window.addEventListener('load', () => {
    setTimeout(() => $('#preloader').classList.add('done'), reduce ? 0 : 1400);
  });

  /* ---------- Navbar scroll state + scroll progress ---------- */
  const nav = $('#nav');
  const progress = $('#progress');
  const toTop = $('#toTop');
  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle('scrolled', y > 30);
    const h = document.documentElement.scrollHeight - innerHeight;
    progress.style.width = (h > 0 ? (y / h) * 100 : 0) + '%';
    toTop.classList.toggle('show', y > 700);
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  toTop.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));

  /* ---------- Mobile menu ---------- */
  const burger = $('#burger');
  burger.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    burger.classList.toggle('open', open);
  });
  $$('#navLinks a').forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('open'); burger.classList.remove('open');
  }));

  /* ---------- Active link on scroll (scrollspy) ---------- */
  const links = $$('#navLinks a');
  const sections = links.map(a => $(a.getAttribute('href'))).filter(Boolean);
  const spy = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const id = '#' + e.target.id;
        links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === id));
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(s => spy.observe(s));

  /* ---------- Scroll reveal ---------- */
  const revealer = new IntersectionObserver((entries, obs) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.14 });
  $$('.reveal, [data-split], .mock').forEach(el => revealer.observe(el));

  /* ---------- Split headline words ---------- */
  $$('[data-split]').forEach(el => {
    $$('.line > span', el).forEach(span => {
      if (span.classList.contains('brace')) return;
      const words = span.textContent.split(' ');
      span.innerHTML = words.map(w => `<span class="word">${w}</span>`).join(' ');
    });
    const words = $$('.word', el);
    words.forEach((w, i) => (w.style.transitionDelay = 0.25 + i * 0.08 + 's'));
  });

  /* ---------- Count-up stats ---------- */
  const countUp = el => {
    const target = +el.dataset.count;
    const suffix = el.dataset.suffix || '';
    const dur = 1600; const start = performance.now();
    const tick = now => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const counter = new IntersectionObserver((entries, obs) => {
    entries.forEach(e => { if (e.isIntersecting) { countUp(e.target); obs.unobserve(e.target); } });
  }, { threshold: 0.6 });
  $$('[data-count]').forEach(el => counter.observe(el));

  /* ---------- Animate mock bars & card once visible ---------- */
  const mockObs = new IntersectionObserver((entries) => {
    entries.forEach(e => e.isIntersecting && e.target.classList.add('in'));
  }, { threshold: 0.3 });
  $$('.mock').forEach(m => mockObs.observe(m));

  /* ---------- Staggered code lines ---------- */
  $$('#codeBlock .ln').forEach((ln, i) => (ln.style.animationDelay = 1.5 + i * 0.06 + 's'));

  if (!reduce) {
    /* ---------- Custom cursor ---------- */
    const dot = $('#cDot'), ring = $('#cRing'), spot = $('#spotlight');
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    addEventListener('mousemove', e => {
      mx = e.clientX; my = e.clientY;
      dot.style.left = mx + 'px'; dot.style.top = my + 'px';
      spot.style.left = mx + 'px'; spot.style.top = my + 'px';
    });
    const ringLoop = () => {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
      requestAnimationFrame(ringLoop);
    };
    ringLoop();
    $$('[data-cursor], a, button').forEach(el => {
      el.addEventListener('mouseenter', () => { dot.classList.add('hover'); ring.classList.add('hover'); });
      el.addEventListener('mouseleave', () => { dot.classList.remove('hover'); ring.classList.remove('hover'); });
    });

    /* ---------- Magnetic buttons ---------- */
    $$('[data-magnetic]').forEach(btn => {
      btn.addEventListener('mousemove', e => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        btn.style.transform = `translate(${x * 0.28}px, ${y * 0.4}px)`;
      });
      btn.addEventListener('mouseleave', () => (btn.style.transform = ''));
    });

    /* ---------- Card spotlight + 3D tilt ---------- */
    $$('.card[data-tilt]').forEach(card => {
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        card.style.setProperty('--mx', px * 100 + '%');
        card.style.setProperty('--my', py * 100 + '%');
        card.style.transform = `translateY(-6px) perspective(900px) rotateY(${(px - .5) * 6}deg) rotateX(${(.5 - py) * 6}deg)`;
      });
      card.addEventListener('mouseleave', () => (card.style.transform = ''));
    });

    /* ---------- Hero code-card parallax tilt ---------- */
    const tilt = $('#tiltCard');
    if (tilt) {
      const hero = $('#home');
      hero.addEventListener('mousemove', e => {
        const r = hero.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        tilt.style.transform = `perspective(1000px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateZ(0)`;
      });
      hero.addEventListener('mouseleave', () => (tilt.style.transform = ''));
    }
  }

  /* ---------- Ripple on buttons ---------- */
  $$('.btn').forEach(btn => btn.addEventListener('click', function (e) {
    const r = this.getBoundingClientRect();
    const s = document.createElement('span');
    s.className = 'ripple';
    const size = Math.max(r.width, r.height);
    s.style.width = s.style.height = size + 'px';
    s.style.left = e.clientX - r.left - size / 2 + 'px';
    s.style.top = e.clientY - r.top - size / 2 + 'px';
    this.appendChild(s);
    setTimeout(() => s.remove(), 600);
  }));

  /* ---------- Pricing toggle ---------- */
  const sw = $('#priceSwitch');
  sw.addEventListener('click', () => {
    const on = sw.classList.toggle('on');
    $('#lblMonthly').classList.toggle('active', !on);
    $('#lblYearly').classList.toggle('active', on);
    $$('.price[data-m]').forEach(p => {
      const v = +(on ? p.dataset.y : p.dataset.m);
      p.textContent = v.toLocaleString('en-US');
    });
  });

  /* ---------- FAQ accordion ---------- */
  $$('.qa').forEach(qa => {
    const q = $('.q', qa), a = $('.a', qa);
    q.addEventListener('click', () => {
      const open = qa.classList.contains('open');
      $$('.qa').forEach(o => { o.classList.remove('open'); $('.a', o).style.maxHeight = null; });
      if (!open) { qa.classList.add('open'); a.style.maxHeight = a.scrollHeight + 'px'; }
    });
  });

  /* ---------- Cookie banner ---------- */
  const cookie = $('#cookie');
  if (!localStorage.getItem('fv_cookie')) {
    setTimeout(() => cookie.classList.add('show'), 2200);
  }
  const closeCookie = v => { localStorage.setItem('fv_cookie', v); cookie.classList.remove('show'); };
  $('#ckAccept').addEventListener('click', () => closeCookie('accepted'));
  $('#ckDecline').addEventListener('click', () => closeCookie('declined'));

  /* ---------- Smooth-scroll for in-page links ---------- */
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id.length > 1) {
      const t = $(id);
      if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); }
    }
  }));
})();
