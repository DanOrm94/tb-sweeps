export default {
  async fetch(request, env) {
    const allowedOrigin = 'https://www.tb-sweeps.com';
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': allowedOrigin,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    if (request.method !== 'POST') {
      return json({ ok: false, error: 'Method not allowed.' }, 405, allowedOrigin);
    }

    if (origin && origin !== allowedOrigin) {
      return json({ ok: false, error: 'Origin not allowed.' }, 403, allowedOrigin);
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return json({ ok: false, error: 'Expected JSON.' }, 415, allowedOrigin);
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return json({ ok: false, error: 'Invalid request.' }, 400, allowedOrigin);
    }

    // Honeypot field: bots should fill this, real users should not.
    if (String(data.website || '').trim()) {
      return json({ ok: true }, 200, allowedOrigin);
    }

    const name = clean(data.name, 120);
    const email = clean(data.email, 254);
    const phone = clean(data.phone, 50);
    const message = clean(data.message, 5000);

    if (!name || !email || !message) {
      return json({ ok: false, error: 'Please complete the required fields.' }, 400, allowedOrigin);
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return json({ ok: false, error: 'Please enter a valid email address.' }, 400, allowedOrigin);
    }

    if (!env.RESEND_API_KEY) {
      return json({ ok: false, error: 'Email service is not configured.' }, 500, allowedOrigin);
    }

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safePhone = escapeHtml(phone || 'Not provided');
    const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');

    const resend = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: env.RESEND_FROM || 'TB Sweeps Website <onboarding@resend.dev>',
        to: ['tomybarker94@icloud.com'],
        reply_to: email,
        subject: `New website enquiry from ${name}`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#222">
            <h2>New TB Sweeps website enquiry</h2>
            <p><strong>Name:</strong> ${safeName}</p>
            <p><strong>Email:</strong> ${safeEmail}</p>
            <p><strong>Phone:</strong> ${safePhone}</p>
            <p><strong>Message:</strong></p>
            <p>${safeMessage}</p>
          </div>
        `
      })
    });

    if (!resend.ok) {
      return json({ ok: false, error: 'We could not send your message. Please call us instead.' }, 502, allowedOrigin);
    }

    return json({ ok: true, message: 'Thanks — your enquiry has been sent.' }, 200, allowedOrigin);
  }
};

function clean(value, maxLength) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Access-Control-Allow-Origin': origin,
      'Cache-Control': 'no-store'
    }
  });
}
