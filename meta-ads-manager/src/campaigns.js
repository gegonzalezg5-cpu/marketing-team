import { apiGet, apiPost } from './api.js';

function normalizeAccountId(id) {
  return id.startsWith('act_') ? id : `act_${id}`;
}

export async function listAccounts() {
  const data = await apiGet('/me/adaccounts', {
    fields: 'id,name,currency,account_status,amount_spent,balance',
    limit: 100,
  });
  return data.data || [];
}

export async function listCampaigns(accountId) {
  const data = await apiGet(`/${normalizeAccountId(accountId)}/campaigns`, {
    fields: 'id,name,status,objective,daily_budget,lifetime_budget,spend_cap,start_time,stop_time',
    limit: 200,
  });
  return data.data || [];
}

export async function listAdSets(campaignId) {
  const data = await apiGet(`/${campaignId}/adsets`, {
    fields: 'id,name,status,daily_budget,lifetime_budget,optimization_goal,billing_event,bid_amount,start_time,end_time',
    limit: 200,
  });
  return data.data || [];
}

export async function listAds(adSetId) {
  const data = await apiGet(`/${adSetId}/ads`, {
    fields: 'id,name,status,adset_id,campaign_id,created_time',
    limit: 200,
  });
  return data.data || [];
}

export async function getInsights(objectId, params = {}) {
  const defaults = {
    fields: 'impressions,clicks,spend,ctr,cpc,cpm,reach,frequency,actions,cost_per_action_type',
    date_preset: 'last_30d',
    level: 'campaign',
  };
  const data = await apiGet(`/${objectId}/insights`, { ...defaults, ...params });
  return data.data || [];
}

export async function pauseObject(objectId) {
  return apiPost(`/${objectId}`, { status: 'PAUSED' });
}

export async function activateObject(objectId) {
  return apiPost(`/${objectId}`, { status: 'ACTIVE' });
}

// amount en USD (ej: 10.00 → se convierte a centavos internamente)
export async function updateBudget(adSetId, amountUsd) {
  const cents = Math.round(parseFloat(amountUsd) * 100);
  return apiPost(`/${adSetId}`, { daily_budget: cents });
}
