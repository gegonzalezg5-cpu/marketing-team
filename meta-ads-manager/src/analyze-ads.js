import 'dotenv/config';
import { getInsights } from './campaigns.js';

const [, , accountId, datePreset = 'last_30d'] = process.argv;

if (!accountId) {
  console.error('Uso: node src/analyze-ads.js <account_id> [date_preset]');
  process.exit(1);
}

function getAction(actions, type) {
  if (!actions) return 0;
  const match = actions.find(a => a.action_type === type);
  return match ? parseFloat(match.value) : 0;
}

function truncate(str, len) {
  return str.length > len ? str.slice(0, len - 3) + '...' : str;
}

async function analyzeAds() {
  console.log(`\n🔬 Análisis de Ads — ${datePreset}\n`);

  const id = accountId.startsWith('act_') ? accountId : `act_${accountId}`;

  const data = await getInsights(id, {
    date_preset: datePreset,
    level: 'ad',
    fields: 'ad_id,ad_name,adset_name,campaign_name,impressions,clicks,spend,reach,actions,ctr,cpc,cpm',
  });

  if (!data.length) {
    console.log('  Sin datos de insights para este período.\n');
    return;
  }

  const ads = data.map(row => {
    const purchases  = getAction(row.actions, 'purchase');
    const addToCart  = getAction(row.actions, 'add_to_cart');
    const spend      = parseFloat(row.spend || 0);
    return {
      id:          row.ad_id,
      name:        row.ad_name || '(sin nombre)',
      adset:       row.adset_name || '—',
      campaign:    row.campaign_name || '—',
      spend,
      impressions: parseInt(row.impressions || 0),
      clicks:      parseInt(row.clicks || 0),
      reach:       parseInt(row.reach || 0),
      purchases,
      addToCart,
      ctr:         parseFloat(row.ctr || 0),
      cpc:         parseFloat(row.cpc || 0),
      cpm:         parseFloat(row.cpm || 0),
      cpa:         purchases > 0 ? spend / purchases : Infinity,
    };
  });

  const COL = 36;
  const header = `  ${'Ad'.padEnd(COL)} | ${'Gasto'.padStart(9)} | ${'Compras'.padStart(8)} | ${'CPA'.padStart(8)} | ${'Carrito'.padStart(7)} | ${'CTR'.padStart(6)}`;
  const sep = '  ' + '-'.repeat(header.length - 2);

  // TOP por Compras
  const byPurchases = [...ads].sort((a, b) => b.purchases - a.purchases).slice(0, 10);
  console.log('  🏆 TOP 10 — Más Compras\n');
  console.log(header);
  console.log(sep);
  for (const ad of byPurchases) {
    const cpa  = ad.cpa < Infinity ? `$${ad.cpa.toFixed(2)}` : '—';
    console.log(
      `  ${truncate(ad.name, COL).padEnd(COL)} | ${('$' + ad.spend.toFixed(2)).padStart(9)} | ${String(ad.purchases).padStart(8)} | ${cpa.padStart(8)} | ${String(ad.addToCart).padStart(7)} | ${ad.ctr.toFixed(2).padStart(5)}%`
    );
  }

  // TOP por CPA (solo ads con compras)
  const withPurchases = ads.filter(a => a.purchases > 0);
  if (withPurchases.length > 0) {
    const byCPA = [...withPurchases].sort((a, b) => a.cpa - b.cpa).slice(0, 10);
    console.log('\n  💡 TOP 10 — Mejor CPA (más eficientes)\n');
    console.log(header);
    console.log(sep);
    for (const ad of byCPA) {
      console.log(
        `  ${truncate(ad.name, COL).padEnd(COL)} | ${('$' + ad.spend.toFixed(2)).padStart(9)} | ${String(ad.purchases).padStart(8)} | ${('$' + ad.cpa.toFixed(2)).padStart(8)} | ${String(ad.addToCart).padStart(7)} | ${ad.ctr.toFixed(2).padStart(5)}%`
      );
    }
  }

  // TOP por CTR (solo ads con gasto real)
  const headerCtr = `  ${'Ad'.padEnd(COL)} | ${'CTR'.padStart(6)} | ${'Clics'.padStart(6)} | ${'Impresiones'.padStart(12)} | ${'Gasto'.padStart(9)} | Compras`;
  const sepCtr = '  ' + '-'.repeat(headerCtr.length - 2);
  const activeAds = ads.filter(a => a.impressions > 100);
  const byCTR = [...activeAds].sort((a, b) => b.ctr - a.ctr).slice(0, 10);
  console.log('\n  📣 TOP 10 — Mejor CTR\n');
  console.log(headerCtr);
  console.log(sepCtr);
  for (const ad of byCTR) {
    console.log(
      `  ${truncate(ad.name, COL).padEnd(COL)} | ${(ad.ctr.toFixed(2) + '%').padStart(6)} | ${String(ad.clicks).padStart(6)} | ${ad.impressions.toLocaleString().padStart(12)} | ${('$' + ad.spend.toFixed(2)).padStart(9)} | ${ad.purchases}`
    );
  }

  // TOP por CPM (más barato = llega a más gente por peso)
  const headerCpm = `  ${'Ad'.padEnd(COL)} | ${'CPM'.padStart(9)} | ${'Impresiones'.padStart(12)} | ${'Gasto'.padStart(9)} | Compras`;
  const sepCpm = '  ' + '-'.repeat(headerCpm.length - 2);
  const byCPM = [...activeAds].sort((a, b) => a.cpm - b.cpm).slice(0, 10);
  console.log('\n  📺 TOP 10 — Mejor CPM (más barato por 1.000 impresiones)\n');
  console.log(headerCpm);
  console.log(sepCpm);
  for (const ad of byCPM) {
    console.log(
      `  ${truncate(ad.name, COL).padEnd(COL)} | ${('$' + ad.cpm.toFixed(0)).padStart(9)} | ${ad.impressions.toLocaleString().padStart(12)} | ${('$' + ad.spend.toFixed(2)).padStart(9)} | ${ad.purchases}`
    );
  }

  // Resumen general
  const total = ads.reduce(
    (acc, a) => ({
      spend:     acc.spend + a.spend,
      purchases: acc.purchases + a.purchases,
      clicks:    acc.clicks + a.clicks,
      addToCart: acc.addToCart + a.addToCart,
    }),
    { spend: 0, purchases: 0, clicks: 0, addToCart: 0 }
  );

  const avgCpa = total.purchases > 0 ? `$${(total.spend / total.purchases).toFixed(2)}` : '—';
  console.log(`\n  📊 Total: ${ads.length} ads | Gasto: $${total.spend.toFixed(2)} | Compras: ${total.purchases} | CPA promedio: ${avgCpa} | Carritos: ${total.addToCart}\n`);
}

analyzeAds().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
