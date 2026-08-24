const WORKER_ORIGIN = 'https://tb-sweeps.danielorm.workers.dev';
const LIVE_ORIGIN = 'https://www.tb-sweeps.com';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/contact') return handleContact(request, env);
    if (request.method !== 'GET' && request.method !== 'HEAD') return json({ ok: false, error: 'Method not allowed.' }, 405, getCorsOrigin(request));
    const response = await env.ASSETS.fetch(request);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return response;
    return new HTMLRewriter()
      .on('a.nav-cta', new BookNowLinkRewriter())
      .on('a[href="https://www.tb-sweeps.com/booknow"]', new BookNowLinkRewriter())
      .transform(response);
  }
};

class BookNowLinkRewriter {
  element(element) { element.setAttribute('href', 'booknow.html'); }
}

async function handleContact(request, env) {
  const origin = getCorsOrigin(request);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed.' }, 405, origin);
  if (request.headers.get('Origin') && !origin) return json({ ok: false, error: 'Origin not allowed.' }, 403, null);
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return json({ ok: false, error: 'Expected JSON.' }, 415, origin);
  let data;
  try { data = await request.json(); } catch { return json({ ok: false, error: 'Invalid request.' }, 400, origin); }
  if (String(data.website || '').trim()) return json({ ok: true }, 200, origin);
  const name = clean(data.name, 120);
  const email = clean(data.email, 254);
  const phone = clean(data.phone, 50);
  const message = clean(data.message, 5000);
  if (!name || !email || !message) return json({ ok: false, error: 'Please complete the required fields.' }, 400, origin);
  if (!/^\S+@\S+\.\S+$/.test(email)) return json({ ok: false, error: 'Please enter a valid email address.' }, 400, origin);
  if (!env.RESEND_API_KEY) return json({ ok: false, error: 'Email service is not configured.' }, 500, origin);
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safePhone = escapeHtml(phone || 'Not provided');
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');
  const resend = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.RESEND_FROM || 'TB Sweeps Website <onboarding@resend.dev>',
      to: ['tomybarker94@icloud.com'],
      reply_to: email,
      subject: `New website enquiry from ${name}`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#222"><h2>New TB Sweeps website enquiry</h2><p><strong>Name:</strong> ${safeName}</p><p><strong>Email:</strong> ${safeEmail}</p><p><strong>Phone:</strong> ${safePhone}</p><p><strong>Message:</strong></p><p>${safeMessage}</p></div>`
    })
  });
  if (!resend.ok) return json({ ok: false, error: 'We could not send your message. Please call us instead.' }, 502, origin);
  return json({ ok: true, message: 'Thanks — your enquiry has been sent.' }, 200, origin);
}

function getCorsOrigin(request) {
  const origin = request.headers.get('Origin');
  if (origin === WORKER_ORIGIN || origin === LIVE_ORIGIN) return origin;
  return origin ? null : LIVE_ORIGIN;
}
function corsHeaders(origin) {
  const headers = { 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}
function clean(value, maxLength) { return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, maxLength); }
function escapeHtml(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }
function json(body, status, origin) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-store', ...corsHeaders(origin) } }); }
