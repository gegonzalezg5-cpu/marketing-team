import 'dotenv/config';
import { writeFile, mkdir } from 'fs/promises';
import { apiGet } from '../src/api.js';

const ACCOUNT_ID = 'act_423794003825268';
const OUT_FILE = '../../meta-ads-dashboard/data/four-store.json';

// ── helpers ────────────────────────────────────────────────────────────────
function getAction(actions, type) {
  if (!actions) return 0;
  const m = actions.find(a => a.action_type === type);
  return m ? parseFloat(m.value) : 0;
}
function getActionValue(vals, type) {
  if (!vals) return 0;
  const m = vals.find(a => a.action_type === type);
  return m ? parseFloat(m.value) : 0;
}
function getRoas(row) {
  if (row.purchase_roas && row.purchase_roas.length) {
    const v = parseFloat(row.purchase_roas[0]?.value || 0);
    if (v > 0) return Math.round(v * 100) / 100;
  }
  const purchaseValue = getActionValue(row.action_values, 'omni_purchase') ||
                        getActionValue(row.action_values, 'purchase');
  const spend = parseFloat(row.spend || 0);
  return spend > 0 && purchaseValue > 0 ? Math.round((purchaseValue / spend) * 100) / 100 : 0;
}
function enrich(row) {
  const purchases      = getAction(row.actions, 'purchase') || getAction(row.actions, 'omni_purchase');
  const addToCart      = getAction(row.actions, 'add_to_cart');
  const purchaseValue  = getActionValue(row.action_values, 'omni_purchase') ||
                         getActionValue(row.action_values, 'purchase');
  const spend          = parseFloat(row.spend || 0);
  const impressions    = parseInt(row.impressions || 0);
  const clicks         = parseInt(row.clicks || 0);
  const reach          = parseInt(row.reach || 0);
  const frequency      = parseFloat(row.frequency || 0);
  const ctr            = parseFloat(row.ctr || 0);
  const cpc            = parseFloat(row.cpc || 0);
  const cpm            = parseFloat(row.cpm || 0);
  const roas           = getRoas(row);
  const cpa            = purchases > 0 ? Math.round(spend / purchases) : null;
  return { ...row, spend, impressions, clicks, reach, frequency, ctr, cpc, cpm,
           purchases, addToCart, purchaseValue, roas, cpa,
           actions: undefined, action_values: undefined, cost_per_action_type: undefined, purchase_roas: undefined };
}

async function fetchInsights(dateParams, level) {
  try {
    const data = await apiGet(`/${ACCOUNT_ID}/insights`, {
      fields: [
        'campaign_id','campaign_name','ad_id','ad_name',
        'impressions','clicks','spend','reach','frequency',
        'actions','action_values','cost_per_action_type',
        'ctr','cpc','cpm','purchase_roas',
      ].join(','),
      level,
      limit: 500,
      ...dateParams,
    });
    return (data.data || []).map(enrich);
  } catch (e) {
    console.warn(`  ⚠ ${level} ${JSON.stringify(dateParams)}: ${e.message}`);
    return [];
  }
}

async function fetchChartData(dateParams) {
  try {
    const data = await apiGet(`/${ACCOUNT_ID}/insights`, {
      fields: 'spend,impressions,clicks,actions,action_values,purchase_roas,date_start,date_stop',
      level: 'account',
      time_increment: 1,
      limit: 100,
      ...dateParams,
    });
    return (data.data || []).map(row => ({
      date: row.date_start,
      spend: parseFloat(row.spend || 0),
      purchases: getAction(row.actions, 'purchase') || getAction(row.actions, 'omni_purchase'),
      impressions: parseInt(row.impressions || 0),
      clicks: parseInt(row.clicks || 0),
      roas: getRoas(row),
    }));
  } catch (e) {
    console.warn('  ⚠ chart data:', e.message);
    return [];
  }
}

async function fetchAdThumbnails(adIds) {
  const creatives = {};
  for (const adId of adIds.slice(0, 25)) {
    try {
      const data = await apiGet(`/${adId}`, {
        fields: 'id,creative{id,thumbnail_url,image_url,object_type,video_id,title,body,name,object_story_spec{video_data{image_url,video_id},link_data{image,message}}}',
      });
      if (!data.creative) continue;
      const c = data.creative;

      const isVideo = c.object_type === 'VIDEO' || !!c.video_id ||
                      !!c.object_story_spec?.video_data?.video_id;
      const videoId = c.video_id || c.object_story_spec?.video_data?.video_id || null;

      // Prefer highest-res image available
      let thumbnail =
        c.image_url ||
        c.object_story_spec?.video_data?.image_url ||
        c.object_story_spec?.link_data?.image ||
        c.thumbnail_url ||
        null;

      // For video ads fetch a bigger thumbnail if possible
      if (isVideo && videoId && !thumbnail) {
        try {
          const vt = await apiGet(`/${videoId}/thumbnails`, { fields: 'uri', limit: 1 });
          thumbnail = vt.data?.[0]?.uri || null;
        } catch { /* skip */ }
      }

      creatives[adId] = {
        thumbnail,
        isVideo,
        videoId,
        title: c.title || c.name || null,
        body: c.body || c.object_story_spec?.link_data?.message || null,
      };
    } catch { /* skip */ }
  }
  return creatives;
}

// ── aggregate: group ads by campaign ───────────────────────────────────────
function groupAdsByCampaign(campaignRows, adRows) {
  const adsByCampaign = {};
  for (const ad of adRows) {
    const cid = ad.campaign_id;
    if (!adsByCampaign[cid]) adsByCampaign[cid] = [];
    adsByCampaign[cid].push({
      id: ad.ad_id,
      name: ad.ad_name,
      spend: ad.spend, impressions: ad.impressions, clicks: ad.clicks,
      reach: ad.reach, frequency: ad.frequency,
      ctr: ad.ctr, cpc: ad.cpc, cpm: ad.cpm,
      purchases: ad.purchases, addToCart: ad.addToCart, purchaseValue: ad.purchaseValue,
      cpa: ad.cpa, roas: ad.roas,
    });
  }
  return campaignRows.map(c => ({
    id: c.campaign_id,
    name: c.campaign_name,
    spend: c.spend, impressions: c.impressions, clicks: c.clicks,
    reach: c.reach, frequency: c.frequency,
    ctr: c.ctr, cpc: c.cpc, cpm: c.cpm,
    purchases: c.purchases, addToCart: c.addToCart, purchaseValue: c.purchaseValue,
    cpa: c.cpa, roas: c.roas,
    ads: (adsByCampaign[c.campaign_id] || []).sort((a, b) => b.spend - a.spend),
  })).filter(c => c.spend > 0).sort((a, b) => b.spend - a.spend);
}

function summaryFrom(campaigns) {
  const s = campaigns.reduce((acc, c) => ({
    spend: acc.spend + c.spend,
    impressions: acc.impressions + c.impressions,
    clicks: acc.clicks + c.clicks,
    reach: acc.reach + c.reach,
    purchases: acc.purchases + c.purchases,
    addToCart: acc.addToCart + c.addToCart,
    purchaseValue: acc.purchaseValue + (c.purchaseValue || 0),
  }), { spend: 0, impressions: 0, clicks: 0, reach: 0, purchases: 0, addToCart: 0, purchaseValue: 0 });
  s.ctr = s.impressions > 0 ? Math.round((s.clicks / s.impressions) * 10000) / 100 : 0;
  s.cpm = s.impressions > 0 ? Math.round((s.spend / s.impressions) * 1000) : 0;
  s.cpa = s.purchases > 0 ? Math.round(s.spend / s.purchases) : null;
  return s;
}

// ── generate insights ───────────────────────────────────────────────────────
function generateInsights(monthlyData) {
  const ads = monthlyData.campaigns.flatMap(c => c.ads);
  const totalSpend = monthlyData.summary.spend;
  const avgCtr = monthlyData.summary.ctr;

  // Segment: ads with meaningful volume (spend > 5K or purchases > 1)
  const activeAds    = ads.filter(a => a.spend > 5000 || a.purchases > 1);
  const withPurchases = activeAds.filter(a => a.purchases > 0);

  // Top performers
  const topByPurchases = [...withPurchases].sort((a, b) => b.purchases - a.purchases)[0];
  const topByRoas      = [...withPurchases].filter(a => a.roas > 0).sort((a, b) => b.roas - a.roas)[0];
  const topByCtr       = [...activeAds].filter(a => a.impressions > 2000).sort((a, b) => b.ctr - a.ctr)[0];
  const topByCpa       = [...withPurchases].filter(a => a.purchases >= 5).sort((a, b) => a.cpa - b.cpa)[0];

  // To review
  const worstCpa       = [...withPurchases].filter(a => a.spend > 20000).sort((a, b) => b.cpa - a.cpa)[0];
  const highSpendNoBuy = ads.filter(a => a.purchases === 0 && a.spend > 15000).sort((a, b) => b.spend - a.spend);

  const topPerformers = [];
  const toReview = [];
  const recommendations = [];

  // ── Top performers ──
  if (topByPurchases) {
    const pct = Math.round((topByPurchases.spend / totalSpend) * 100);
    topPerformers.push({
      icon: '🏆',
      title: `Líder en ventas: ${topByPurchases.name}`,
      body: `${topByPurchases.purchases} compras · $${topByPurchases.cpa?.toLocaleString('es-CL')} CLP CPA · ROAS ${topByPurchases.roas > 0 ? topByPurchases.roas + 'x' : 'N/D'} · ${pct}% del presupuesto. Creativo principal del mes.`,
    });
  }

  if (topByRoas && topByRoas.id !== topByPurchases?.id) {
    topPerformers.push({
      icon: '💰',
      title: `Mejor ROAS: ${topByRoas.name}`,
      body: `ROAS ${topByRoas.roas}x con ${topByRoas.purchases} compras y $${topByRoas.spend.toLocaleString('es-CL')} invertidos. Por cada $1 gastado retorna $${topByRoas.roas} en ventas.`,
    });
  }

  if (topByCtr && topByCtr.id !== topByPurchases?.id) {
    const vsAvg = ((topByCtr.ctr / avgCtr) * 100 - 100).toFixed(0);
    topPerformers.push({
      icon: '📣',
      title: `CTR líder: ${topByCtr.name}`,
      body: `${topByCtr.ctr.toFixed(2)}% CTR — ${vsAvg}% por encima del promedio de la cuenta (${avgCtr.toFixed(2)}%). Alto engagement con la audiencia.`,
    });
  }

  if (topByCpa && topByCpa.id !== topByPurchases?.id && topByCpa.id !== topByRoas?.id) {
    topPerformers.push({
      icon: '🎯',
      title: `Mejor CPA con volumen: ${topByCpa.name}`,
      body: `$${topByCpa.cpa?.toLocaleString('es-CL')} CLP por compra con ${topByCpa.purchases} conversiones. Eficiencia + volumen = candidato a escalar.`,
    });
  }

  // ── To review ──
  if (worstCpa && worstCpa.cpa > 10000) {
    toReview.push({
      icon: '⚠️',
      title: `CPA ineficiente: ${worstCpa.name}`,
      body: `$${worstCpa.cpa?.toLocaleString('es-CL')} CLP por compra con $${worstCpa.spend.toLocaleString('es-CL')} gastados · solo ${worstCpa.purchases} venta${worstCpa.purchases !== 1 ? 's' : ''}. Revisar ángulo creativo o pausar.`,
    });
  }

  for (const s of highSpendNoBuy.slice(0, 2)) {
    toReview.push({
      icon: '🔴',
      title: `Sin conversiones: ${s.name}`,
      body: `$${s.spend.toLocaleString('es-CL')} CLP gastados · 0 compras · ${s.addToCart || 0} carritos. ${s.cpm < 1500 ? 'CPM bajo ($' + Math.round(s.cpm) + ') = problema post-clic, no de alcance.' : 'Revisar segmentación y creativos.'}`,
    });
  }

  // ── Recommendations ──
  if (topByPurchases) {
    recommendations.push({
      icon: '🚀',
      title: `Escalar "${topByPurchases.name}" +30–50%`,
      body: `${topByPurchases.purchases} compras demuestran curva de aprendizaje completada. Subir presupuesto del ad set sin cambiar segmentación ni creativos.`,
    });
  }

  if (topByCtr) {
    recommendations.push({
      icon: '🎯',
      title: `Iterar sobre el gancho de "${topByCtr.name}"`,
      body: `CTR ${topByCtr.ctr.toFixed(2)}% es una señal fuerte. Producir 2–3 variaciones del primer frame/gancho con la misma propuesta de valor.`,
    });
  }

  if (highSpendNoBuy.length > 0) {
    const totalWasted = highSpendNoBuy.reduce((s, a) => s + a.spend, 0);
    recommendations.push({
      icon: '🛑',
      title: `Pausar ${highSpendNoBuy.length} ad${highSpendNoBuy.length > 1 ? 's' : ''} sin conversiones`,
      body: `${highSpendNoBuy.map(a => `"${a.name}"`).join(', ')} acumulan $${totalWasted.toLocaleString('es-CL')} CLP sin retorno. Redirigir ese presupuesto a creativos ganadores.`,
    });
  }

  if (worstCpa && worstCpa.cpa > 15000) {
    recommendations.push({
      icon: '✂️',
      title: `Revisar presupuesto de "${worstCpa.name}"`,
      body: `CPA $${worstCpa.cpa?.toLocaleString('es-CL')} es ${Math.round(worstCpa.cpa / (monthlyData.summary.cpa || 1))}x el CPA promedio. Reducir o pausar para liberar presupuesto.`,
    });
  }

  return { topPerformers, toReview, recommendations };
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('📊 Fetching Four Store Meta Ads data...\n');

  // Dates for this week and last week
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const daysToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisMonday = new Date(now); thisMonday.setDate(now.getDate() - daysToMon);
  const thisSunday = new Date(thisMonday); thisSunday.setDate(thisMonday.getDate() + 6);
  const lastMonday = new Date(thisMonday); lastMonday.setDate(thisMonday.getDate() - 7);
  const lastSunday = new Date(lastMonday); lastSunday.setDate(lastMonday.getDate() + 6);

  const fmtDate = d => d.toISOString().split('T')[0];
  const thisWeekSince = fmtDate(thisMonday);
  const thisWeekUntil = fmtDate(now); // up to today
  const lastWeekSince = fmtDate(lastMonday);
  const lastWeekUntil = fmtDate(lastSunday);

  // Dynamic week label (handles cross-month weeks)
  const monthAbbr = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const weekLabel = (since, until) => {
    const s = new Date(since + 'T00:00:00');
    const u = new Date(until + 'T00:00:00');
    if (s.getMonth() === u.getMonth()) {
      return `${s.getDate()} - ${u.getDate()} ${monthAbbr[s.getMonth()]}`;
    }
    return `${s.getDate()} ${monthAbbr[s.getMonth()]} - ${u.getDate()} ${monthAbbr[u.getMonth()]}`;
  };

  console.log(`  Esta semana:  ${thisWeekSince} → ${thisWeekUntil}`);
  console.log(`  Sem. anterior: ${lastWeekSince} → ${lastWeekUntil}`);
  console.log(`  Este mes: this_month`);
  console.log(`  Mes anterior: last_month\n`);

  const thisWeekParams = { time_range: JSON.stringify({ since: thisWeekSince, until: thisWeekUntil }) };
  const lastWeekParams = { time_range: JSON.stringify({ since: lastWeekSince, until: lastWeekUntil }) };
  const monthlyParams  = { date_preset: 'this_month' };
  const prevMonthParams = { date_preset: 'last_month' };

  console.log('  Fetching insights...');
  const [
    thisWeekCamp, thisWeekAds,
    lastWeekCamp, lastWeekAds,
    monthlyCamp,  monthlyAds,
    prevMonthCamp, prevMonthAds,
    chartData,
  ] = await Promise.all([
    fetchInsights(thisWeekParams,  'campaign'),
    fetchInsights(thisWeekParams,  'ad'),
    fetchInsights(lastWeekParams,  'campaign'),
    fetchInsights(lastWeekParams,  'ad'),
    fetchInsights(monthlyParams,   'campaign'),
    fetchInsights(monthlyParams,   'ad'),
    fetchInsights(prevMonthParams, 'campaign'),
    fetchInsights(prevMonthParams, 'ad'),
    fetchChartData(monthlyParams),
  ]);

  console.log(`  ✓ Esta semana: ${thisWeekCamp.length} campañas, ${thisWeekAds.length} ads`);
  console.log(`  ✓ Sem. anterior: ${lastWeekCamp.length} campañas, ${lastWeekAds.length} ads`);
  console.log(`  ✓ Mensual: ${monthlyCamp.length} campañas, ${monthlyAds.length} ads`);
  console.log(`  ✓ Mes anterior: ${prevMonthCamp.length} campañas, ${prevMonthAds.length} ads`);

  // Build campaign trees
  const thisWeekData  = { campaigns: groupAdsByCampaign(thisWeekCamp, thisWeekAds) };
  const lastWeekData  = { campaigns: groupAdsByCampaign(lastWeekCamp, lastWeekAds) };
  const monthlyData   = { campaigns: groupAdsByCampaign(monthlyCamp, monthlyAds) };
  const prevMonthData = { campaigns: groupAdsByCampaign(prevMonthCamp, prevMonthAds) };

  thisWeekData.summary  = summaryFrom(thisWeekData.campaigns);
  lastWeekData.summary  = summaryFrom(lastWeekData.campaigns);
  monthlyData.summary   = summaryFrom(monthlyData.campaigns);
  prevMonthData.summary = summaryFrom(prevMonthData.campaigns);

  // Weekly chart: aggregate daily into weeks
  const weeklyChart = [];
  const dayMs = 86400000;
  for (let i = 0; i < 4; i++) {
    const weekStart = new Date(now.getFullYear(), now.getMonth(), 1);
    weekStart.setDate(1 + i * 7);
    const weekEnd = new Date(weekStart.getTime() + 6 * dayMs);
    const label = `${weekStart.getDate()}/${weekStart.getMonth() + 1}`;
    const rows = chartData.filter(r => {
      const d = new Date(r.date);
      return d >= weekStart && d <= weekEnd;
    });
    if (rows.length === 0 && i > 0) continue;
    weeklyChart.push({
      label,
      spend: Math.round(rows.reduce((s, r) => s + r.spend, 0)),
      purchases: rows.reduce((s, r) => s + r.purchases, 0),
      impressions: rows.reduce((s, r) => s + r.impressions, 0),
      clicks: rows.reduce((s, r) => s + r.clicks, 0),
    });
  }

  // Top ads for showcase (by purchases, then by CPA)
  const allMonthlyAds = monthlyData.campaigns.flatMap(c => c.ads);
  const topAds = [...allMonthlyAds]
    .filter(a => a.purchases > 0)
    .sort((a, b) => b.purchases - a.purchases)
    .slice(0, 4)
    .map((ad, i) => ({
      ...ad,
      badge: i === 0 ? 'Más Ventas' : i === 1 ? 'Top 2' : i === 2 ? 'Mejor CPA' : 'Top CTR',
      badgeColor: i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'green' : 'blue',
    }));

  // Enrich top ads badge by actual metric
  if (topAds.length >= 3) {
    const byCPA = [...allMonthlyAds].filter(a => a.purchases > 0).sort((a, b) => a.cpa - b.cpa)[0];
    const topCTR = [...allMonthlyAds].filter(a => a.impressions > 1000).sort((a, b) => b.ctr - a.ctr)[0];
    topAds.forEach(ad => {
      if (ad.id === byCPA?.id)  { ad.badge = 'Mejor CPA'; ad.badgeColor = 'green'; }
      if (ad.id === topCTR?.id) { ad.badge = 'Mejor CTR'; ad.badgeColor = 'blue'; }
    });
  }

  // Fetch thumbnails for top ads
  const topAdIds = topAds.map(a => a.id).filter(Boolean);
  console.log(`\n  Fetching thumbnails for ${topAdIds.length} top ads...`);
  const creatives = await fetchAdThumbnails(topAdIds);
  topAds.forEach(ad => {
    if (creatives[ad.id]) {
      ad.thumbnail = creatives[ad.id].thumbnail;
      ad.creativeTitle = creatives[ad.id].title;
    }
  });

  // Generate insights
  console.log('  Generating insights...');
  const insights = generateInsights(monthlyData);

  // Month labels
  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const monthLabel     = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  const prevMonthDate  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthLabel = `${monthNames[prevMonthDate.getMonth()]} ${prevMonthDate.getFullYear()}`;

  const output = {
    meta: {
      account: 'Four Store',
      account_id: ACCOUNT_ID,
      currency: 'CLP',
      generated_at: now.toISOString(),
      month_label: monthLabel,
      prev_month_label: prevMonthLabel,
    },
    weeks: [
      {
        id: 'last_week',
        label: weekLabel(lastWeekSince, lastWeekUntil),
        since: lastWeekSince,
        until: lastWeekUntil,
        ...lastWeekData,
      },
      {
        id: 'this_week',
        label: weekLabel(thisWeekSince, thisWeekUntil),
        since: thisWeekSince,
        until: thisWeekUntil,
        ...thisWeekData,
      },
    ],
    monthly: {
      label: monthLabel,
      ...monthlyData,
      chart: weeklyChart,
    },
    prev_month: {
      label: prevMonthLabel,
      ...prevMonthData,
    },
    topAds,
    insights,
  };

  try {
    await mkdir('../../meta-ads-dashboard/data', { recursive: true });
  } catch {}
  await writeFile(
    new URL(OUT_FILE, import.meta.url),
    JSON.stringify(output, null, 2)
  );

  console.log(`\n✅ Data saved → data/four-store.json`);
  console.log(`   Esta semana:  $${thisWeekData.summary.spend.toLocaleString('es-CL')} | ${thisWeekData.summary.purchases} compras`);
  console.log(`   Este mes:     $${monthlyData.summary.spend.toLocaleString('es-CL')} | ${monthlyData.summary.purchases} compras`);
  console.log(`   Mes anterior: $${prevMonthData.summary.spend.toLocaleString('es-CL')} | ${prevMonthData.summary.purchases} compras`);
  console.log(`   Top ads:      ${topAds.length} (con thumbnails: ${topAds.filter(a => a.thumbnail).length})`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
