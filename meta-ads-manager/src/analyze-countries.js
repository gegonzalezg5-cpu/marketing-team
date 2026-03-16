import 'dotenv/config';
import { getInsights } from './campaigns.js';

const [, , accountId, datePreset = 'last_30d'] = process.argv;

if (!accountId) {
  console.error('Uso: node src/analyze-countries.js <account_id> [date_preset]');
  process.exit(1);
}

function getAction(actions, type) {
  if (!actions) return 0;
  const match = actions.find(a => a.action_type === type);
  return match ? parseFloat(match.value) : 0;
}

function pad(str, len, right = false) {
  const s = String(str);
  return right ? s.padEnd(len) : s.padStart(len);
}

async function analyzeByCountry() {
  console.log(`\n🌎 Análisis por País — ${datePreset}\n`);

  const id = accountId.startsWith('act_') ? accountId : `act_${accountId}`;

  const data = await getInsights(id, {
    date_preset: datePreset,
    level: 'account',
    breakdowns: 'country',
    fields: 'country,impressions,clicks,spend,reach,actions,cost_per_action_type',
  });

  if (!data.length) {
    console.log('  Sin datos para este período.\n');
    return;
  }

  // Agrupar por país
  const map = {};
  for (const row of data) {
    const c = row.country || 'XX';
    if (!map[c]) map[c] = { country: c, spend: 0, impressions: 0, clicks: 0, reach: 0, purchases: 0, addToCart: 0 };
    map[c].spend       += parseFloat(row.spend || 0);
    map[c].impressions += parseInt(row.impressions || 0);
    map[c].clicks      += parseInt(row.clicks || 0);
    map[c].reach       += parseInt(row.reach || 0);
    map[c].purchases   += getAction(row.actions, 'purchase');
    map[c].addToCart   += getAction(row.actions, 'add_to_cart');
  }

  // Ordenar por CPA (mejor primero; sin compras al final)
  const sorted = Object.values(map).sort((a, b) => {
    const cpaA = a.purchases > 0 ? a.spend / a.purchases : Infinity;
    const cpaB = b.purchases > 0 ? b.spend / b.purchases : Infinity;
    return cpaA - cpaB;
  });

  const header = `  ${'País'.padEnd(6)} | ${'Gasto'.padStart(10)} | ${'Compras'.padStart(8)} | ${'CPA'.padStart(8)} | ${'C.Carrito'.padStart(9)} | ${'CTR'.padStart(6)} | Alcance`;
  const sep = '  ' + '-'.repeat(header.length - 2);

  console.log(header);
  console.log(sep);

  for (const c of sorted) {
    const cpa = c.purchases > 0 ? `$${(c.spend / c.purchases).toFixed(2)}` : '—';
    const ctr = c.impressions > 0 ? `${((c.clicks / c.impressions) * 100).toFixed(2)}%` : '—';
    console.log(
      `  ${pad(c.country, 6, true)} | ${pad('$' + c.spend.toFixed(2), 10)} | ${pad(c.purchases, 8)} | ${pad(cpa, 8)} | ${pad(c.addToCart, 9)} | ${pad(ctr, 6)} | ${c.reach.toLocaleString()}`
    );
  }

  // Totales
  const total = sorted.reduce(
    (acc, c) => ({
      spend: acc.spend + c.spend,
      purchases: acc.purchases + c.purchases,
      clicks: acc.clicks + c.clicks,
      impressions: acc.impressions + c.impressions,
      addToCart: acc.addToCart + c.addToCart,
    }),
    { spend: 0, purchases: 0, clicks: 0, impressions: 0, addToCart: 0 }
  );

  const totalCpa = total.purchases > 0 ? `$${(total.spend / total.purchases).toFixed(2)}` : '—';
  console.log(sep);
  console.log(
    `  ${'TOTAL'.padEnd(6)} | ${pad('$' + total.spend.toFixed(2), 10)} | ${pad(total.purchases, 8)} | ${pad(totalCpa, 8)} | ${pad(total.addToCart, 9)}`
  );
  console.log();
}

analyzeByCountry().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
