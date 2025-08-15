// api/payfast/create-checkout.js
const crypto = require('crypto');

const money = n => Number(n).toFixed(2);

// Build ONE canonical string (x-www-form-urlencoded with + for spaces)
// and use it BOTH for the signature and the URL we send to PayFast.
function buildQuery(params) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== '' && v != null) u.append(k, String(v));
  }
  // URLSearchParams.toString() uses + for spaces (form encoding) – PayFast is happy with this.
  return u.toString();
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { plan='youtube', quantity=1, billingCycle='monthly', email='', whatsapp='' } = req.body || {};

  // pricing
  const prices = { youtube: 49, spotify: 39, bundle: 79 };
  const cycles  = { monthly: 1, quarterly: 3*0.95, yearly: 12*0.88 };
  const qty = Math.max(1, Math.min(6, parseInt(quantity || 1, 10)));
  const amount = money((prices[plan] || 49) * qty * (cycles[billingCycle] || 1));

  // env (force sandbox creds in sandbox; NEVER add passphrase in sandbox)
  const forceSandbox = (process.env.PAYFAST_ENV || '').toLowerCase() === 'sandbox';
  const merchant_id  = forceSandbox ? '10000100'      : process.env.PAYFAST_MERCHANT_ID;
  const merchant_key = forceSandbox ? '46f0cd694581a' : process.env.PAYFAST_MERCHANT_KEY;
  const PASS         = (process.env.PAYFAST_PASSPHRASE || '').trim();

  if (!merchant_id || !merchant_key) {
    return res.status(500).json({ error: 'Missing PayFast credentials for current environment' });
  }

  const host  = forceSandbox ? 'https://sandbox.payfast.co.za' : 'https://www.payfast.co.za';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const base  = `${proto}://${req.headers.host}`;

  // params (ASCII hyphen in item_name; drop empty values)
  const P = {
    amount,
    cancel_url: `${base}/cancel.html`,
    custom_str1: whatsapp || undefined,
    custom_str2: plan || undefined,
    custom_str3: billingCycle || undefined,
    custom_str4: String(qty),
    email_address: email || 'test@example.com',
    item_name: `WeShare ${plan} - ${billingCycle}`,
    merchant_id,
    merchant_key,
    m_payment_id: `WS-${Date.now()}`,
    name_first: email ? email.split('@')[0] : 'WeShare',
    name_last: 'Customer',
    notify_url: `${base}/api/payfast/ipn`,
    return_url: `${base}/success.html`,
  };

  // 1) Build canonical query in ALPHABETICAL KEY ORDER
  const keys = Object.keys(P).filter(k => P[k] !== '' && P[k] != null).sort();
  const ordered = Object.fromEntries(keys.map(k => [k, P[k]]));
  const query = buildQuery(ordered);

  // 2) Signature over the EXACT SAME encoded string (+ passphrase only when LIVE)
  let sigStr = query;
  if (!forceSandbox && PASS) sigStr += `&passphrase=${encodeURIComponent(PASS)}`;
  const signature = crypto.createHash('md5').update(sigStr).digest('hex');

  // 3) Final URL uses that exact query + signature
  const url = `${host}/eng/process?${query}&signature=${signature}`;

  // DEBUG SWITCH: set ?debug=1 on your request body to get internals back
  if (req.query && String(req.query.debug) === '1') {
    return res.json({ ok: true, env: forceSandbox ? 'sandbox' : 'live', query, sigStr, signature, url });
  }

  return res.json({ ok: true, url, sandbox: forceSandbox });
};
