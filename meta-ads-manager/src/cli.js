import 'dotenv/config';
import {
  listAccounts,
  listCampaigns,
  listAdSets,
  listAds,
  getInsights,
  pauseObject,
  activateObject,
  updateBudget,
} from './campaigns.js';

const [, , command, ...args] = process.argv;

function getAction(actions, type) {
  if (!actions) return 0;
  const match = actions.find(a => a.action_type === type);
  return match ? parseFloat(match.value) : 0;
}

const HELP = `
Ad Manager CLI — Meta Marketing API v21.0

Comandos:
  accounts                                  Listar cuentas de anuncios
  campaigns  <account_id>                   Listar campañas
  adsets     <campaign_id>                  Listar ad sets
  ads        <adset_id>                     Listar ads
  insights   <object_id> [preset] [level]   Ver métricas (default: last_30d / campaign)
  pause      <object_id>                    Pausar campaña / adset / ad
  activate   <object_id>                    Activar campaña / adset / ad
  budget     <adset_id> <monto_usd>        Cambiar presupuesto diario

Presets de fecha: today  yesterday  last_7d  last_30d  this_month  last_month
Levels:          account  campaign  adset  ad
`;

const commands = {
  async accounts() {
    const accounts = await listAccounts();
    console.log(`\n📊 Ad Accounts (${accounts.length})\n`);
    for (const acc of accounts) {
      const status = acc.account_status === 1 ? '✅ ACTIVA' : '⏸️  PAUSADA';
      const spent = acc.amount_spent ? (acc.amount_spent / 100).toFixed(2) : '0.00';
      console.log(`  ${status}  ${acc.name}`);
      console.log(`           ID: ${acc.id} | Moneda: ${acc.currency} | Gastado: $${spent}`);
      console.log();
    }
  },

  async campaigns() {
    const [accountId] = args;
    if (!accountId) return console.error('Uso: node src/cli.js campaigns <account_id>');
    const list = await listCampaigns(accountId);
    console.log(`\n📣 Campañas (${list.length})\n`);
    for (const c of list) {
      const budget = c.daily_budget
        ? `Diario: $${(c.daily_budget / 100).toFixed(2)}`
        : c.lifetime_budget
        ? `Lifetime: $${(c.lifetime_budget / 100).toFixed(2)}`
        : 'Sin presupuesto';
      console.log(`  [${c.status}] ${c.name}`);
      console.log(`           ID: ${c.id} | Objetivo: ${c.objective} | ${budget}`);
      console.log();
    }
  },

  async adsets() {
    const [campaignId] = args;
    if (!campaignId) return console.error('Uso: node src/cli.js adsets <campaign_id>');
    const list = await listAdSets(campaignId);
    console.log(`\n🎯 Ad Sets (${list.length})\n`);
    for (const s of list) {
      const budget = s.daily_budget
        ? `Diario: $${(s.daily_budget / 100).toFixed(2)}`
        : s.lifetime_budget
        ? `Lifetime: $${(s.lifetime_budget / 100).toFixed(2)}`
        : 'Sin presupuesto';
      console.log(`  [${s.status}] ${s.name}`);
      console.log(`           ID: ${s.id} | Optimización: ${s.optimization_goal} | ${budget}`);
      console.log();
    }
  },

  async ads() {
    const [adSetId] = args;
    if (!adSetId) return console.error('Uso: node src/cli.js ads <adset_id>');
    const list = await listAds(adSetId);
    console.log(`\n📌 Ads (${list.length})\n`);
    for (const ad of list) {
      console.log(`  [${ad.status}] ${ad.name}`);
      console.log(`           ID: ${ad.id}`);
      console.log();
    }
  },

  async insights() {
    const [objectId, datePreset = 'last_30d', level = 'campaign'] = args;
    if (!objectId) return console.error('Uso: node src/cli.js insights <object_id> [preset] [level]');

    const data = await getInsights(objectId, { date_preset: datePreset, level });
    console.log(`\n📈 Insights — ${datePreset} (nivel: ${level})\n`);

    for (const row of data) {
      const purchases = getAction(row.actions, 'purchase');
      const spend = parseFloat(row.spend || 0);
      const cpa = purchases > 0 ? `$${(spend / purchases).toFixed(2)}` : '—';
      const name = row.campaign_name || row.adset_name || row.ad_name || objectId;

      console.log(`  ${name}`);
      console.log(`  Gasto: $${spend.toFixed(2)} | Impresiones: ${parseInt(row.impressions || 0).toLocaleString()} | Clics: ${row.clicks || 0}`);
      console.log(`  CTR: ${parseFloat(row.ctr || 0).toFixed(2)}% | CPC: $${parseFloat(row.cpc || 0).toFixed(2)} | CPM: $${parseFloat(row.cpm || 0).toFixed(2)}`);
      console.log(`  Compras: ${purchases} | CPA: ${cpa}`);
      console.log();
    }
  },

  async pause() {
    const [objectId] = args;
    if (!objectId) return console.error('Uso: node src/cli.js pause <object_id>');
    await pauseObject(objectId);
    console.log(`\n⏸️  ${objectId} pausado correctamente.\n`);
  },

  async activate() {
    const [objectId] = args;
    if (!objectId) return console.error('Uso: node src/cli.js activate <object_id>');
    await activateObject(objectId);
    console.log(`\n▶️  ${objectId} activado correctamente.\n`);
  },

  async budget() {
    const [adSetId, amount] = args;
    if (!adSetId || !amount) return console.error('Uso: node src/cli.js budget <adset_id> <monto_usd>');
    await updateBudget(adSetId, amount);
    console.log(`\n💰 Presupuesto diario de ${adSetId} actualizado a $${parseFloat(amount).toFixed(2)} USD.\n`);
  },
};

if (!command || !commands[command]) {
  console.log(HELP);
} else {
  commands[command]().catch(err => {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  });
}
