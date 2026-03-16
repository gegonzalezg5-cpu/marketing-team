/* ═══════════════════════════════════════════════════════════════
   shopify.js — Four Store Shopify Dashboard
═══════════════════════════════════════════════════════════════ */

let data = null;
let activeWeek = 'this_week';
let dailyChart = null;

// ── Format helpers ────────────────────────────────────────────
const clp = v => v == null ? '—' : '$' + Math.round(v).toLocaleString('es-CL');
const num = v => v == null ? '—' : Math.round(v).toLocaleString('es-CL');
const pct = v => v == null ? '—' : v.toFixed(2) + '%';

function fmtDelta(val) {
  if (val == null) return '';
  const sign = val > 0 ? '+' : '';
  const cls = val > 0 ? 'up' : val < 0 ? 'down' : 'neutral';
  const arrow = val > 0 ? '↑' : val < 0 ? '↓' : '→';
  return `<span class="kpi-hero-card__delta ${cls}">${arrow} ${sign}${val}%</span>`;
}

// ── Render hero KPIs ──────────────────────────────────────────
function renderHero(d) {
  const w = d.weeks.find(w => w.id === 'this_week');
  const s = w.summary;
  const vs = w.vs_prev;

  document.getElementById('hero-subtitle').textContent =
    `Semana ${w.label} · ${d.meta.store}`;

  document.getElementById('generated-at').textContent =
    `Actualizado ${new Date(d.meta.generated_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`;

  const kpis = [
    { label: 'Sesiones', value: num(s.sessions), delta: vs?.sessions, up: true },
    { label: 'Tasa Conversión', value: pct(s.convRate), delta: vs?.convRate, up: true },
    { label: 'Pedidos', value: num(s.orders), delta: vs?.orders, up: true },
    { label: 'Ventas Totales', value: clp(s.revenue), delta: vs?.revenue, up: true },
  ];

  document.getElementById('kpi-hero-grid').innerHTML = kpis.map(k => `
    <div class="kpi-hero-card">
      <div class="kpi-hero-card__label">${k.label}</div>
      <div class="kpi-hero-card__value" data-target="${k.value}">${k.value}</div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        ${fmtDelta(k.delta)}
        ${k.delta != null ? '<span class="kpi-hero-card__vs">vs semana anterior</span>' : ''}
      </div>
    </div>
  `).join('');
}

// ── Render week tabs ──────────────────────────────────────────
function renderTabs(d) {
  document.getElementById('week-tabs').innerHTML = d.weeks.map(w => `
    <button class="week-tab ${w.id === activeWeek ? 'active' : ''}" onclick="switchWeek('${w.id}')">
      ${w.label}
    </button>
  `).join('');
}

function switchWeek(id) {
  activeWeek = id;
  renderTabs(data);
  renderWeekContent(data);
}

// ── Render chart ──────────────────────────────────────────────
function renderChart(daily) {
  const labels = daily.map(d => d.label);
  const sessions = daily.map(d => d.sessions);
  const orders = daily.map(d => d.orders);

  if (dailyChart) dailyChart.destroy();

  const ctx = document.getElementById('dailyChart').getContext('2d');
  dailyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Sesiones',
          data: sessions,
          backgroundColor: 'rgba(24,119,242,0.25)',
          borderColor: 'rgba(24,119,242,0.8)',
          borderWidth: 1.5,
          borderRadius: 4,
          yAxisID: 'y'
        },
        {
          label: 'Pedidos',
          data: orders,
          backgroundColor: 'rgba(150,191,72,0.7)',
          borderColor: 'rgba(150,191,72,1)',
          borderWidth: 1.5,
          borderRadius: 4,
          yAxisID: 'y2',
          type: 'line',
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: 'rgba(150,191,72,1)'
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: 'rgba(255,255,255,0.5)', font: { size: 12 } }
        },
        tooltip: {
          backgroundColor: 'rgba(15,15,20,0.95)',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          callbacks: {
            label: ctx => {
              if (ctx.dataset.label === 'Sesiones') return ` ${ctx.parsed.y.toLocaleString('es-CL')} sesiones`;
              return ` ${ctx.parsed.y} pedidos`;
            }
          }
        }
      },
      scales: {
        x: { ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: {
          position: 'left',
          ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 11 } },
          grid: { color: 'rgba(255,255,255,0.04)' },
          title: { display: true, text: 'Sesiones', color: 'rgba(255,255,255,0.3)', font: { size: 11 } }
        },
        y2: {
          position: 'right',
          ticks: { color: 'rgba(150,191,72,0.6)', font: { size: 11 } },
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'Pedidos', color: 'rgba(150,191,72,0.5)', font: { size: 11 } }
        }
      }
    }
  });
}

// ── Render daily table ────────────────────────────────────────
function renderDailyTable(daily) {
  const totalSessions = daily.reduce((s, d) => s + d.sessions, 0);
  const totalOrders = daily.reduce((s, d) => s + d.orders, 0);
  const totalRevenue = daily.reduce((s, d) => s + d.revenue, 0);
  const avgConv = totalOrders && totalSessions ? (totalOrders / totalSessions * 100) : 0;

  document.getElementById('daily-table-wrap').innerHTML = `
    <div class="shopify-chart-wrap">
      <table class="daily-table">
        <thead>
          <tr>
            <th>Día</th>
            <th>Sesiones</th>
            <th>Pedidos</th>
            <th>Conv.</th>
            <th>Ventas</th>
            <th>Ticket Prom.</th>
          </tr>
        </thead>
        <tbody>
          ${daily.map(d => `
            <tr>
              <td>${d.label}</td>
              <td>${num(d.sessions)}</td>
              <td class="highlight">${d.orders}</td>
              <td>${d.sessions ? (d.orders / d.sessions * 100).toFixed(2) + '%' : '—'}</td>
              <td>${clp(d.revenue)}</td>
              <td>${d.orders ? clp(d.revenue / d.orders) : '—'}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="border-top: 1px solid rgba(255,255,255,0.1)">
            <td style="font-weight:700;color:var(--text-primary)">Total</td>
            <td style="font-weight:600;color:var(--text-primary)">${num(totalSessions)}</td>
            <td style="font-weight:700;color:var(--secondary)">${totalOrders}</td>
            <td style="font-weight:600;color:var(--text-primary)">${avgConv.toFixed(2)}%</td>
            <td style="font-weight:700;color:var(--secondary)">${clp(totalRevenue)}</td>
            <td style="font-weight:600;color:var(--text-primary)">${totalOrders ? clp(totalRevenue / totalOrders) : '—'}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

// ── Render week content ───────────────────────────────────────
function renderWeekContent(d) {
  const week = d.weeks.find(w => w.id === activeWeek);
  if (!week) return;
  document.getElementById('chart-title').textContent =
    `Sesiones y pedidos diarios · ${week.label}`;
  renderChart(week.daily);
  renderDailyTable(week.daily);
}

// ── Init ──────────────────────────────────────────────────────
async function init() {
  try {
    const res = await fetch('../../data/shopify-four-store.json');
    data = await res.json();

    renderHero(data);
    renderTabs(data);
    renderWeekContent(data);

    if (typeof setupProgressBar === 'function') setupProgressBar();
    if (typeof setupScrollAnimations === 'function') setupScrollAnimations();
    if (typeof animateHero === 'function') animateHero();
    if (typeof setupNavHighlight === 'function') setupNavHighlight();

  } catch (err) {
    console.error('Error cargando datos Shopify:', err);
    document.getElementById('hero-subtitle').textContent = 'Error cargando datos';
  }
}

init();
