/* ═══════════════════════════════════════════════════════════════
   MAIN.JS — Four Store Meta Ads Dashboard
═══════════════════════════════════════════════════════════════ */

const DATA_URL = '../../data/four-store.json';
let DATA = null;
let activeWeekId = 'this_week';
let campaignChart = null;

/* ── Load data ─────────────────────────────────────────────── */
async function loadData() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error('No se pudo cargar data/four-store.json');
  return res.json();
}

/* ── Color helpers ─────────────────────────────────────────── */
function cpaClass(cpa) {
  if (!cpa) return 'val-dim';
  if (cpa < 4000)  return 'val-green';
  if (cpa < 8000)  return 'val-primary';
  if (cpa > 15000) return 'val-red';
  return '';
}
function ctrClass(ctr) {
  if (ctr >= 4) return 'val-green';
  if (ctr >= 2) return '';
  return 'val-dim';
}
function roasClass(roas) {
  if (roas >= 2) return 'val-roas';
  if (roas >= 1) return '';
  return 'val-dim';
}

/* ── Render hero ───────────────────────────────────────────── */
function renderHero(data) {
  const week = data.weeks.find(w => w.id === 'this_week') || data.weeks[data.weeks.length - 1];
  const s = week.summary;

  document.getElementById('hero-subtitle').textContent =
    `${data.meta.month_label}  ·  Semana ${week.label}`;
  document.getElementById('generated-at').textContent =
    'Actualizado ' + new Date(data.meta.generated_at).toLocaleDateString('es-CL',
      { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  document.getElementById('footer-date').textContent =
    'Generado el ' + new Date(data.meta.generated_at).toLocaleDateString('es-CL', { dateStyle: 'long' });

  const kpiDefs = [
    { label: 'Gasto Semanal', value: s.spend,     type: 'clp', cls: 'kpi-card--primary', sub: `${s.purchases} compras esta semana` },
    { label: 'CPA Promedio',  value: s.cpa,        type: 'clp', cls: 'kpi-card--gold',   sub: `${fmt.num(s.purchases)} conversiones` },
    { label: 'CTR Promedio',  value: s.ctr,        type: 'pct', cls: '',                 sub: `${fmt.num(s.clicks)} clics` },
    { label: 'CPM Promedio',  value: s.cpm,        type: 'clp', cls: '',                 sub: `${fmt.num(s.impressions)} impresiones` },
  ];

  document.getElementById('hero-kpis').innerHTML = `
    <div class="kpi-grid">
      ${kpiDefs.map(k => `
        <div class="kpi-card ${k.cls}">
          <div class="kpi-card__label">${k.label}</div>
          <div class="kpi-card__value"
               data-counter="${k.value || 0}"
               data-counter-type="${k.type}">
            ${k.type === 'clp' ? fmt.clp(0) : k.type === 'pct' ? '0.00%' : '0'}
          </div>
          <div class="kpi-card__delta">${k.sub || ''}</div>
        </div>
      `).join('')}
    </div>`;
}

/* ── Render campaign card ──────────────────────────────────── */
// showAds=false → hide expand button + ads table (used in monthly section)
function renderCampaignCard(c, idx, showAds = true) {
  const ads = c.ads || [];

  const adsRows = ads.map(ad => `
    <tr>
      <td title="${ad.name}">${ad.name.length > 44 ? ad.name.slice(0, 42) + '…' : ad.name}</td>
      <td>${fmt.clp(ad.spend)}</td>
      <td>${ad.purchases > 0
        ? '<strong style="color:var(--text)">' + ad.purchases + '</strong>'
        : '<span class="val-dim">0</span>'}</td>
      <td>${ad.purchaseValue > 0 ? fmt.clp(Math.round(ad.purchaseValue)) : '<span class="val-dim">—</span>'}</td>
      <td class="${cpaClass(ad.cpa)}">${fmt.cpa(ad.cpa)}</td>
      <td>${ad.cpc > 0 ? fmt.clp(Math.round(ad.cpc)) : '<span class="val-dim">—</span>'}</td>
      <td class="${ctrClass(ad.ctr)}">${fmt.pct(ad.ctr)}</td>
      <td>${fmt.clp(ad.cpm)}</td>
      <td>${fmt.freq(ad.frequency)}</td>
      <td class="${roasClass(ad.roas)}">${fmt.roas(ad.roas)}</td>
    </tr>`).join('');

  return `
    <div class="campaign-card" id="camp-${idx}" data-open="false">
      <div class="campaign-card__header" ${showAds ? `onclick="toggleCard('${idx}')"` : 'style="cursor:default"'}>
        <div class="campaign-card__name-wrap">
          <div class="campaign-card__name">
            <span class="status-dot status-dot--active"></span>
            ${c.name}
          </div>
          <div class="campaign-card__ads-count">${showAds ? `${ads.length} anuncio${ads.length !== 1 ? 's' : ''} · click para ver detalle` : `${ads.length} anuncio${ads.length !== 1 ? 's' : ''}`}</div>
        </div>
        <div class="campaign-card__metrics">
          <div class="metric"><span class="metric__label">Gasto</span><span class="metric__value">${fmt.clp(c.spend)}</span></div>
          <div class="metric"><span class="metric__label">Compras</span><span class="metric__value">${c.purchases}</span></div>
          <div class="metric"><span class="metric__label">Val.Compra</span><span class="metric__value" style="color:var(--green)">${c.purchaseValue > 0 ? fmt.clp(Math.round(c.purchaseValue)) : '—'}</span></div>
          <div class="metric metric--highlight"><span class="metric__label">CPA</span><span class="metric__value ${cpaClass(c.cpa)}">${fmt.cpa(c.cpa)}</span></div>
          <div class="metric"><span class="metric__label">CPC</span><span class="metric__value">${c.cpc > 0 ? fmt.clp(Math.round(c.cpc)) : '—'}</span></div>
          <div class="metric"><span class="metric__label">CTR</span><span class="metric__value ${ctrClass(c.ctr)}">${fmt.pct(c.ctr)}</span></div>
          <div class="metric"><span class="metric__label">CPM</span><span class="metric__value">${fmt.clp(c.cpm)}</span></div>
          <div class="metric"><span class="metric__label">Frec.</span><span class="metric__value">${fmt.freq(c.frequency)}</span></div>
          <div class="metric metric--roas"><span class="metric__label">ROAS</span><span class="metric__value ${roasClass(c.roas)}">${fmt.roas(c.roas)}</span></div>
        </div>
        ${showAds ? '<button class="campaign-card__toggle" aria-label="Expandir anuncios">+</button>' : ''}
      </div>
      ${showAds ? `
      <div class="campaign-card__ads">
        <div class="ads-table-wrap">
          <table class="ads-table">
            <thead>
              <tr>
                <th style="text-align:left">Anuncio</th>
                <th>Gasto</th><th>Compras</th><th>Val.Compra</th>
                <th>CPA</th><th>CPC</th><th>CTR</th>
                <th>CPM</th><th>Frec.</th><th>ROAS</th>
              </tr>
            </thead>
            <tbody>${adsRows || '<tr><td colspan="10" class="val-dim" style="text-align:center;padding:16px">Sin datos de anuncios</td></tr>'}</tbody>
          </table>
        </div>
      </div>` : ''}
    </div>`;
}

window.toggleCard = function(idx) {
  const card = document.getElementById('camp-' + idx);
  if (!card) return;
  const open = card.dataset.open === 'true';
  card.dataset.open = open ? 'false' : 'true';
  card.classList.toggle('campaign-card--open', !open);
};

/* ── Weekly ────────────────────────────────────────────────── */
function renderWeekly(data) {
  const selector = document.getElementById('week-selector');

  // Build tab list: weekly tabs + monthly accumulative + previous month
  const tabs = [
    ...data.weeks.map(w => ({
      id: w.id,
      label: (w.id === 'this_week' ? '📅 ' : '📆 ') + w.label,
    })),
    { id: 'monthly_accum', label: `📊 ${data.meta.month_label} (acum.)` },
    { id: 'prev_month',    label: `🗓 ${data.meta.prev_month_label}` },
  ];

  selector.innerHTML = tabs.map(t => `
    <button class="week-btn ${t.id === activeWeekId ? 'week-btn--active' : ''}"
            onclick="switchWeek('${t.id}')">
      ${t.label}
    </button>`).join('');

  renderWeekCampaigns(data);
}

window.switchWeek = function(weekId) {
  activeWeekId = weekId;
  // Update active state on buttons without full re-render
  document.querySelectorAll('.week-btn').forEach(btn => {
    const isActive = btn.getAttribute('onclick')?.includes(`'${weekId}'`);
    btn.classList.toggle('week-btn--active', isActive);
  });
  renderWeekCampaigns(DATA);
};

function renderWeekCampaigns(data) {
  const container = document.getElementById('weekly-campaigns');

  let campaigns = [];
  if (activeWeekId === 'monthly_accum') {
    campaigns = data.monthly.campaigns;
  } else if (activeWeekId === 'prev_month') {
    campaigns = data.prev_month?.campaigns || [];
  } else {
    const week = data.weeks.find(w => w.id === activeWeekId);
    campaigns = week?.campaigns || [];
  }

  if (!campaigns.length) {
    container.innerHTML = '<div class="empty-state">Sin campañas activas en este período</div>';
  } else {
    container.innerHTML = campaigns.map((c, i) => renderCampaignCard(c, `w${i}`)).join('');
  }
}

/* ── Monthly KPIs ──────────────────────────────────────────── */
function renderMonthlySummary(data) {
  const s = data.monthly.summary;
  document.getElementById('monthly-label-desc').textContent =
    `${data.meta.month_label} · acumulado mensual`;

  document.getElementById('monthly-summary').innerHTML = `
    <div class="kpi-grid" style="margin-bottom:var(--s8)">
      ${[
        { label: 'Gasto Total',  value: s.spend,       type: 'clp', cls: 'kpi-card--primary' },
        { label: 'Compras',      value: s.purchases,   type: 'num', cls: 'kpi-card--gold' },
        { label: 'CPA Promedio', value: s.cpa,         type: 'clp', cls: '' },
        { label: 'CTR',          value: s.ctr,         type: 'pct', cls: '' },
        { label: 'CPM',          value: s.cpm,         type: 'clp', cls: '' },
        { label: 'Alcance',      value: s.reach,       type: 'num', cls: '' },
        { label: 'Clics',        value: s.clicks,      type: 'num', cls: '' },
        { label: 'Impresiones',  value: s.impressions, type: 'num', cls: '' },
      ].map(k => `
        <div class="kpi-card ${k.cls}">
          <div class="kpi-card__label">${k.label}</div>
          <div class="kpi-card__value" data-counter="${k.value || 0}" data-counter-type="${k.type}">
            ${k.type === 'clp' ? fmt.clp(0) : '0'}
          </div>
        </div>`).join('')}
    </div>`;
}

/* ── Campaign spend bar chart (replaces week chart) ─────────── */
const CAMPAIGN_COLORS = [
  '#1877f2', '#8b5cf6', '#22c55e', '#f59e0b',
  '#ef4444', '#06b6d4', '#ec4899', '#84cc16',
];

function renderCampaignChart(data) {
  const ctx = document.getElementById('campaignChart');
  if (!ctx) return;
  if (campaignChart) { campaignChart.destroy(); }

  const campaigns = [...data.monthly.campaigns].sort((a, b) => b.spend - a.spend);
  if (!campaigns.length) return;

  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const labels  = campaigns.map(c => c.name.length > 30 ? c.name.slice(0, 28) + '…' : c.name);
  const spends  = campaigns.map(c => c.spend);
  const colors  = campaigns.map((_, i) => CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length]);

  campaignChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Gasto (CLP)',
        data: spends,
        backgroundColor: colors.map(c => c + '33'),
        borderColor: colors,
        borderWidth: 1.5,
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0d0d1c',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          titleColor: '#e4e4f0',
          bodyColor: '#9090b8',
          callbacks: {
            label: (ctx) => {
              const pct = ((ctx.parsed.x / totalSpend) * 100).toFixed(1);
              return ` ${fmt.clp(ctx.parsed.x)} · ${pct}% del total`;
            },
          },
        },
        datalabels: { display: false },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#636380',
            font: { size: 12 },
            callback: v => '$' + (v / 1000).toFixed(0) + 'K',
          },
        },
        y: {
          grid: { display: false },
          ticks: { color: '#9090b8', font: { size: 12 } },
        },
      },
    },
  });
}

/* ── Monthly campaigns ─────────────────────────────────────── */
function renderMonthlyCampaigns(data) {
  const container = document.getElementById('monthly-campaigns');
  if (!data.monthly.campaigns.length) {
    container.innerHTML = '<div class="empty-state">Sin campañas activas este mes</div>';
    return;
  }
  container.innerHTML = data.monthly.campaigns
    .map((c, i) => renderCampaignCard(c, `m${i}`, false))
    .join('');
}

/* ── Creative showcase ─────────────────────────────────────── */
function renderShowcase(data) {
  const grid = document.getElementById('showcase-grid');
  if (!data.topAds || !data.topAds.length) {
    grid.innerHTML = '<div class="empty-state">Sin datos de anuncios top</div>';
    return;
  }

  grid.innerHTML = data.topAds.map((ad, i) => {
    const badgeCls = {
      'Más Ventas': 'badge--gold',
      'Top 2':      'badge--silver',
      'Mejor CPA':  'badge--green',
      'Mejor CTR':  'badge--blue',
    }[ad.badge] || 'badge--blue';

    const isVideo = ad.isVideo || false;

    let thumbContent;
    if (ad.thumbnail) {
      thumbContent = `
        <img src="${ad.thumbnail}"
             alt="${ad.name}"
             loading="lazy"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="showcase-card__thumb-placeholder" style="display:none">${placeholderSVG()}</div>
        ${isVideo ? `<div class="showcase-card__play-btn"><svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="23" fill="rgba(0,0,0,0.55)" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/><path d="M19 14 L38 24 L19 34 Z" fill="white"/></svg></div>` : ''}`;
    } else {
      thumbContent = `<div class="showcase-card__thumb-placeholder">${placeholderSVG()}</div>`;
    }

    return `
      <div class="showcase-card" onclick="openLightbox(${i})">
        <div class="showcase-card__thumb">
          ${thumbContent}
          <span class="showcase-card__badge ${badgeCls}">${ad.badge}</span>
        </div>
        <div class="showcase-card__body">
          <div class="showcase-card__name">${ad.name}</div>
          <div class="showcase-card__stats">
            <div class="showcase-stat showcase-stat--highlight">
              <span class="showcase-stat__label">Compras</span>
              <span class="showcase-stat__value">${ad.purchases}</span>
            </div>
            <div class="showcase-stat">
              <span class="showcase-stat__label">CPA</span>
              <span class="showcase-stat__value">${fmt.cpa(ad.cpa)}</span>
            </div>
            <div class="showcase-stat">
              <span class="showcase-stat__label">CTR</span>
              <span class="showcase-stat__value">${fmt.pct(ad.ctr)}</span>
            </div>
            <div class="showcase-stat">
              <span class="showcase-stat__label">Gasto</span>
              <span class="showcase-stat__value">${fmt.clp(ad.spend)}</span>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');
}

/* ── Lightbox ──────────────────────────────────────────────── */
window.openLightbox = function(idx) {
  const ad = DATA.topAds[idx];
  if (!ad) return;
  const overlay = document.getElementById('lightbox');
  const content = document.getElementById('lightbox-content');

  const badgeCls = {
    'Más Ventas': 'badge--gold',
    'Top 2':      'badge--silver',
    'Mejor CPA':  'badge--green',
    'Mejor CTR':  'badge--blue',
  }[ad.badge] || 'badge--blue';

  content.innerHTML = `
    <button class="lightbox__close" onclick="closeLightbox()">✕</button>
    <div class="lightbox__inner">
      <div class="lightbox__media">
        ${ad.thumbnail
          ? `<img src="${ad.thumbnail}" alt="${ad.name}"
                  style="max-width:100%;max-height:70vh;object-fit:contain;border-radius:8px;display:block;margin:0 auto"
                  onerror="this.style.display='none'">`
          : `<div style="display:flex;align-items:center;justify-content:center;height:300px;background:var(--bg-elevated);border-radius:8px">${placeholderSVG()}</div>`}
        ${ad.isVideo ? `<div style="margin-top:12px;text-align:center"><span style="font-size:12px;color:var(--text-dim)">📹 Anuncio de video · </span><a href="https://adsmanager.facebook.com/adsmanager/manage/ads?act=423794003825268&selected_ad_id=${ad.id}" target="_blank" style="font-size:12px;color:var(--primary)">Ver en Meta Ads Manager →</a></div>` : ''}
      </div>
      <div class="lightbox__info">
        <span class="showcase-card__badge ${badgeCls}" style="margin-bottom:12px;display:inline-block">${ad.badge}</span>
        <h3 style="font-size:18px;font-weight:700;margin-bottom:16px;line-height:1.3">${ad.name}</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          ${[
            { l: 'Compras',    v: ad.purchases,             cls: 'val-primary' },
            { l: 'CPA',        v: fmt.cpa(ad.cpa),          cls: cpaClass(ad.cpa) },
            { l: 'CTR',        v: fmt.pct(ad.ctr),          cls: ctrClass(ad.ctr) },
            { l: 'CPM',        v: fmt.clp(ad.cpm),          cls: '' },
            { l: 'Gasto',      v: fmt.clp(ad.spend),        cls: '' },
            { l: 'ROAS',       v: fmt.roas(ad.roas),        cls: roasClass(ad.roas) },
            { l: 'Carritos',   v: ad.addToCart || '—',      cls: '' },
            { l: 'Impres.',    v: fmt.num(ad.impressions),  cls: '' },
          ].map(m => `
            <div style="background:var(--bg-elevated);border-radius:8px;padding:12px">
              <div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px">${m.l}</div>
              <div style="font-size:18px;font-weight:800" class="${m.cls}">${m.v}</div>
            </div>`).join('')}
        </div>
      </div>
    </div>`;

  overlay.classList.add('lightbox--open');
  document.body.style.overflow = 'hidden';
};

window.closeLightbox = function() {
  document.getElementById('lightbox').classList.remove('lightbox--open');
  document.body.style.overflow = '';
};

function placeholderSVG() {
  return `<svg width="64" height="64" viewBox="0 0 64 64" fill="none">
    <rect x="8" y="8" width="48" height="48" rx="8" stroke="white" stroke-width="1.5"/>
    <circle cx="22" cy="26" r="5" stroke="white" stroke-width="1.5"/>
    <path d="M8 42 L20 30 L30 42 L42 26 L56 42" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
  </svg>`;
}

/* ── Insights: 2 columns (no recommendations here) ─────────── */
function renderInsights(data) {
  const { topPerformers, toReview } = data.insights;
  const container = document.getElementById('insights-layout');

  const insightCard = c => `
    <div class="insight-card">
      <div class="insight-card__header">
        <span class="insight-card__icon">${c.icon}</span>
        <span class="insight-card__title">${c.title}</span>
      </div>
      <div class="insight-card__body">${c.body}</div>
    </div>`;

  container.innerHTML = `
    <div class="insights-col insights-col--good">
      <div class="insights-col__title">✅ Lo que está funcionando</div>
      ${topPerformers.map(insightCard).join('')}
    </div>
    <div class="insights-col insights-col--bad">
      <div class="insights-col__title">❌ Lo que NO está funcionando</div>
      ${toReview.map(insightCard).join('')}
    </div>`;
}

/* ── Recomendaciones Genaro ────────────────────────────────── */
function renderRecommendations(data) {
  const { recommendations } = data.insights;
  const container = document.getElementById('recommendations-list');
  if (!container) return;

  container.innerHTML = recommendations.map((r, i) => `
    <div class="reco-card">
      <div class="reco-card__num">${String(i + 1).padStart(2, '0')}</div>
      <div class="reco-card__content">
        <div class="reco-card__header">
          <span class="reco-card__icon">${r.icon}</span>
          <span class="reco-card__title">${r.title}</span>
        </div>
        <div class="reco-card__body">${r.body}</div>
      </div>
    </div>`).join('');
}

/* ── Init ──────────────────────────────────────────────────── */
async function init() {
  try {
    DATA = await loadData();

    renderHero(DATA);
    renderWeekly(DATA);           // renders campaigns + comparison table
    renderMonthlySummary(DATA);
    renderCampaignChart(DATA);    // new bar chart
    renderMonthlyCampaigns(DATA);
    renderShowcase(DATA);
    renderInsights(DATA);
    renderRecommendations(DATA);

    // Close lightbox on backdrop click
    document.getElementById('lightbox')?.addEventListener('click', (e) => {
      if (e.target.id === 'lightbox') closeLightbox();
    });
    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeLightbox();
    });

    animateHero();
    setupScrollAnimations();
    setupCounters();

  } catch (err) {
    console.error('Dashboard error:', err);
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;
                  flex-direction:column;gap:16px;color:#9090b8;font-family:Inter,sans-serif">
        <div style="font-size:48px">⚠️</div>
        <div style="font-size:16px;color:#e4e4f0">Error cargando datos</div>
        <div style="font-size:13px">${err.message}</div>
        <div style="font-size:12px;opacity:0.5">Ejecuta primero: node scripts/fetch-dashboard-data.js</div>
      </div>`;
  }
}

document.addEventListener('DOMContentLoaded', init);
