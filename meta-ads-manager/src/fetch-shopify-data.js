import { config } from 'dotenv';
config({ path: new URL('../.env.shopify', import.meta.url).pathname });
import { writeFileSync } from 'fs';

const STORE = process.env.SHOPIFY_STORE;
const TOKEN = process.env.SHOPIFY_TOKEN;
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const API_VERSION = '2026-01';

// ── Auto-refresh token ──────────────────────────────────────────
async function refreshToken() {
  const res = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'client_credentials' })
  });
  const data = await res.json();
  return data.access_token;
}

// ── Helpers ─────────────────────────────────────────────────────
function getWeekDates(offsetWeeks = 0) {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + offsetWeeks * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  const fmt = d => d.toISOString().split('T')[0];
  const label = d => d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
  return { since: fmt(monday), until: fmt(sunday), label: `${label(monday)} – ${label(sunday)}` };
}

async function shopifyGet(path) {
  const res = await fetch(`https://${STORE}/admin/api/${API_VERSION}/${path}`, {
    headers: { 'X-Shopify-Access-Token': TOKEN }
  });
  return res.json();
}

async function shopifyQL(query) {
  const res = await fetch(`https://${STORE}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `{ shopifyqlQuery(query: "${query}") { parseErrors tableData { columns { name dataType } rows } } }` })
  });
  const json = await res.json();
  const result = json?.data?.shopifyqlQuery;
  if (result?.parseErrors?.length) console.warn('ShopifyQL errors:', result.parseErrors);
  return result?.tableData?.rows || [];
}

// ── Fetch orders for a date range ───────────────────────────────
async function fetchOrders(since, until) {
  const data = await shopifyGet(
    `orders.json?status=any&created_at_min=${since}T00:00:00-03:00&created_at_max=${until}T23:59:59-03:00&fields=id,created_at,total_price,subtotal_price,financial_status&limit=250`
  );
  const orders = data.orders || [];
  const totalRevenue = orders.reduce((s, o) => s + parseFloat(o.total_price), 0);
  const aov = orders.length ? totalRevenue / orders.length : 0;

  // daily breakdown
  const byDay = {};
  for (const o of orders) {
    const day = o.created_at.slice(0, 10);
    if (!byDay[day]) byDay[day] = { orders: 0, revenue: 0 };
    byDay[day].orders++;
    byDay[day].revenue += parseFloat(o.total_price);
  }

  return { count: orders.length, revenue: Math.round(totalRevenue), aov: Math.round(aov), byDay };
}

// ── Build week data ──────────────────────────────────────────────
async function fetchWeekData(since, until, label) {
  const [orders, sessionsRows, dailySessionRows] = await Promise.all([
    fetchOrders(since, until),
    shopifyQL(`FROM sessions SINCE ${since} UNTIL ${until} SHOW sessions, conversion_rate`),
    shopifyQL(`FROM sessions SINCE ${since} UNTIL ${until} TIMESERIES day SHOW sessions, conversion_rate`)
  ]);

  const sessions = parseInt(sessionsRows[0]?.sessions || 0);
  const convRate = parseFloat(sessionsRows[0]?.conversion_rate || 0);

  // merge daily orders + sessions
  const allDays = new Set([
    ...Object.keys(orders.byDay),
    ...dailySessionRows.map(r => r.day)
  ]);

  const daily = Array.from(allDays).sort().map(day => {
    const o = orders.byDay[day] || { orders: 0, revenue: 0 };
    const s = dailySessionRows.find(r => r.day === day);
    return {
      day,
      label: new Date(day + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: 'short' }),
      sessions: parseInt(s?.sessions || 0),
      orders: o.orders,
      revenue: Math.round(o.revenue),
      convRate: parseFloat(s?.conversion_rate || 0)
    };
  });

  return {
    since, until, label,
    summary: {
      sessions,
      orders: orders.count,
      revenue: orders.revenue,
      aov: orders.aov,
      convRate: Math.round(convRate * 10000) / 100
    },
    daily
  };
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  console.log('🔄 Refreshing Shopify token...');
  const freshToken = await refreshToken();
  // Use fresh token for this run
  process.env.SHOPIFY_TOKEN = freshToken;
  // Re-bind TOKEN (need module-level workaround)
  global._shopifyToken = freshToken;

  console.log('📦 Fetching Shopify data...');

  const thisWeek = getWeekDates(0);
  const lastWeek = getWeekDates(-1);

  console.log(`  This week: ${thisWeek.since} → ${thisWeek.until}`);
  console.log(`  Last week: ${lastWeek.since} → ${lastWeek.until}`);

  const [thisWeekData, lastWeekData] = await Promise.all([
    fetchWeekData(thisWeek.since, thisWeek.until, thisWeek.label),
    fetchWeekData(lastWeek.since, lastWeek.until, lastWeek.label)
  ]);

  // Compute week-over-week deltas
  const delta = (curr, prev) => prev === 0 ? null : Math.round(((curr - prev) / prev) * 1000) / 10;

  const output = {
    meta: {
      store: 'Four Store',
      url: 'fourstore.cl',
      generated_at: new Date().toISOString(),
      currency: 'CLP'
    },
    weeks: [
      {
        id: 'this_week',
        label: thisWeekData.label,
        since: thisWeekData.since,
        until: thisWeekData.until,
        summary: thisWeekData.summary,
        daily: thisWeekData.daily,
        vs_prev: {
          sessions: delta(thisWeekData.summary.sessions, lastWeekData.summary.sessions),
          orders: delta(thisWeekData.summary.orders, lastWeekData.summary.orders),
          revenue: delta(thisWeekData.summary.revenue, lastWeekData.summary.revenue),
          aov: delta(thisWeekData.summary.aov, lastWeekData.summary.aov),
          convRate: delta(thisWeekData.summary.convRate, lastWeekData.summary.convRate)
        }
      },
      {
        id: 'last_week',
        label: lastWeekData.label,
        since: lastWeekData.since,
        until: lastWeekData.until,
        summary: lastWeekData.summary,
        daily: lastWeekData.daily,
        vs_prev: null
      }
    ]
  };

  const outPath = '/Users/genarogonzalez/Documents/marketing-team/meta-ads-dashboard/data/shopify-four-store.json';
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`✅ Guardado en ${outPath}`);
  console.log(`   Esta semana: ${thisWeekData.summary.orders} pedidos | $${thisWeekData.summary.revenue.toLocaleString('es-CL')} | ${thisWeekData.summary.sessions.toLocaleString()} sesiones`);
}

// Fix: use global token for all requests
const origFetch = global.fetch;
global.fetch = async (url, opts = {}) => {
  if (global._shopifyToken && url.includes(STORE)) {
    opts.headers = { ...opts.headers, 'X-Shopify-Access-Token': global._shopifyToken };
  }
  return origFetch(url, opts);
};

main().catch(console.error);
