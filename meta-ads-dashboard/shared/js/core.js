/* ═══════════════════════════════════════════════════════════════
   CORE.JS — Funciones compartidas
═══════════════════════════════════════════════════════════════ */

/* ── Formatting ────────────────────────────────────────────── */
const fmt = {
  clp(v) {
    if (v === null || v === undefined) return '—';
    return '$' + Math.round(v).toLocaleString('es-CL');
  },
  pct(v, dec = 2) {
    if (v === null || v === undefined) return '—';
    return parseFloat(v).toFixed(dec) + '%';
  },
  num(v) {
    if (v === null || v === undefined) return '—';
    return Math.round(v).toLocaleString('es-CL');
  },
  roas(v) {
    if (!v || v === 0) return '—';
    return parseFloat(v).toFixed(2) + 'x';
  },
  freq(v) {
    if (!v || v === 0) return '—';
    return parseFloat(v).toFixed(1);
  },
  cpa(v) {
    if (!v) return '—';
    return '$' + Math.round(v).toLocaleString('es-CL');
  },
};

/* ── Progress bar ──────────────────────────────────────────── */
function setupProgressBar() {
  const bar = document.getElementById('progress-bar');
  if (!bar) return;
  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width = pct + '%';
  }, { passive: true });
}

/* ── Animated counter ──────────────────────────────────────── */
function animateCounter(el, target, duration = 1200, formatter = (v) => Math.round(v).toLocaleString('es-CL')) {
  if (!el) return;
  const start = performance.now();
  const from = 0;

  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = formatter(from + (target - from) * eased);
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

/* ── Counter observer ──────────────────────────────────────── */
function setupCounters() {
  const counters = document.querySelectorAll('[data-counter]');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.dataset.counted) {
        entry.target.dataset.counted = '1';
        const target = parseFloat(entry.target.dataset.counter);
        const type = entry.target.dataset.counterType || 'num';
        let formatter;
        if (type === 'clp')   formatter = v => '$' + Math.round(v).toLocaleString('es-CL');
        else if (type === 'pct') formatter = v => v.toFixed(2) + '%';
        else if (type === 'roas') formatter = v => v.toFixed(2) + 'x';
        else formatter = v => Math.round(v).toLocaleString('es-CL');
        animateCounter(entry.target, target, 1200, formatter);
      }
    });
  }, { threshold: 0.3 });
  counters.forEach(el => observer.observe(el));
}

/* ── GSAP scroll fade-in ───────────────────────────────────── */
function setupScrollAnimations() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  // Fade-in for section titles
  gsap.utils.toArray('.section__header').forEach(el => {
    gsap.fromTo(el,
      { opacity: 0, y: 30 },
      {
        opacity: 1, y: 0,
        duration: 0.7,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 85%' }
      }
    );
  });

  // Stagger campaign cards
  gsap.utils.toArray('.campaigns-list').forEach(list => {
    const cards = list.querySelectorAll('.campaign-card');
    gsap.fromTo(cards,
      { opacity: 0, y: 24 },
      {
        opacity: 1, y: 0,
        duration: 0.5,
        stagger: 0.06,
        ease: 'power2.out',
        scrollTrigger: { trigger: list, start: 'top 85%' }
      }
    );
  });

  // Showcase cards
  const showcaseCards = document.querySelectorAll('.showcase-card');
  if (showcaseCards.length) {
    gsap.fromTo(showcaseCards,
      { opacity: 0, y: 40, scale: 0.97 },
      {
        opacity: 1, y: 0, scale: 1,
        duration: 0.6,
        stagger: 0.1,
        ease: 'power2.out',
        scrollTrigger: { trigger: '#showcase-grid', start: 'top 80%' }
      }
    );
  }

  // Insight cards
  gsap.utils.toArray('.insight-card').forEach((card, i) => {
    gsap.fromTo(card,
      { opacity: 0, x: -20 },
      {
        opacity: 1, x: 0,
        duration: 0.45,
        delay: i * 0.05,
        ease: 'power2.out',
        scrollTrigger: { trigger: card, start: 'top 88%' }
      }
    );
  });

  // Chart container
  const chartEl = document.querySelector('.chart-container');
  if (chartEl) {
    gsap.fromTo(chartEl,
      { opacity: 0, y: 20 },
      {
        opacity: 1, y: 0,
        duration: 0.6,
        ease: 'power2.out',
        scrollTrigger: { trigger: chartEl, start: 'top 85%' }
      }
    );
  }
}

/* ── Hero entrance animation ───────────────────────────────── */
function animateHero() {
  if (typeof gsap === 'undefined') return;
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  tl.to('.hero__eyebrow',  { opacity: 1, y: 0, duration: 0.5, delay: 0.1 })
    .to('.hero__title',    { opacity: 1, y: 0, duration: 0.7 }, '-=0.2')
    .to('.hero__subtitle', { opacity: 1, y: 0, duration: 0.6 }, '-=0.4')
    .to('.hero__kpis',     { opacity: 1, y: 0, duration: 0.5 }, '-=0.3');
}

/* ── Nav active link ───────────────────────────────────────── */
function setupNavHighlight() {
  const sections = document.querySelectorAll('section[id]');
  const links = document.querySelectorAll('.nav__links a');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        links.forEach(a => {
          a.style.color = a.getAttribute('href') === '#' + entry.target.id
            ? 'var(--text)'
            : '';
        });
      }
    });
  }, { threshold: 0.4 });

  sections.forEach(s => observer.observe(s));
}

/* ── Init ──────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  setupProgressBar();
  setupNavHighlight();
});
