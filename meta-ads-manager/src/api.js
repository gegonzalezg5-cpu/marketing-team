import 'dotenv/config';

const BASE_URL = `https://graph.facebook.com/${process.env.META_API_VERSION || 'v21.0'}`;
const TOKEN = process.env.META_ACCESS_TOKEN;

export async function apiGet(path, params = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set('access_token', TOKEN);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.error) {
    throw new Error(`Meta API Error: ${data.error.message} (code: ${data.error.code})`);
  }
  return data;
}

export async function apiPost(path, body = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set('access_token', TOKEN);

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });

  const data = await res.json();

  if (data.error) {
    throw new Error(`Meta API Error: ${data.error.message} (code: ${data.error.code})`);
  }
  return data;
}
