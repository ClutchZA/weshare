// api/payfast/create-checkout.js
const crypto = require('crypto');

const money = n => Number(n).toFixed(2);
const enc   = v => encodeURIComponent(String(v));

function ordered(obj) {
  const out = {};
  Object.keys(obj)
    .filter(k => obj[k] !== '' && obj[k] != null)
    .sort()
    .forEach(k => (out[k] = String(obj[k]).trim()));
  return out;
}
function qsPlus(obj) {               // spaces => '+'
  const u = new URLSearchParams();
  for (const [k,v] of Object.entries(obj)) u.append(k, v);
  return u.toString();
}
function qsPct(obj) {                // spaces => '%20'
  return Object.entries(obj).map(([k,v]) => `${k}=${enc(v)}`).join('&');
}
function sign(base, pass) {
  const s = pass ? `${base}&passphrase=${enc(pass)}` : base;
  return crypto.createHash('md5').update(s).digest('hex');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error:'Method not allowed' });

  const { plan='youtube', quantity=1, billingCycle='monthly', email='test@example.com', whatsapp='' } = req.body || {};

  // pricing
  const prices = { youtube:49, spotify:39, bundle:79 };
  const cycles = { monthly:1, quarterly:3*0.95, yearly:12*0.88 };
  const qty    = Math.max(1, Math.min(6, parseInt(quantity || 1, 10)));
  const amount = money((prices[plan] || 49) * qty * (cycles[billingCycle] || 1));

  // env
  const forceSandbox = (process.env.PAYFAST_ENV || '').toLowerCase() === 'sandbox';
  const merchant_id  = forceSandbox ? '10000100'      : process.env.PAYFAST_MERCHANT_ID;
  const merchant_key = forceSandbox ? '46f0cd694581a' : process.env.PAYFAST_MERCHANT_KEY;
  const PASS         = !forceSandbox ? (process.env.PAYFAST_PASSPHRASE || '').trim() : '';

  if (!merchant_id || !merchant_key) return res.status(500).json({ error:'Missing PayFast credentials' });

  const host  = forceSandbox ? 'https://sandbox.payfast.co.za' : 'https://www.payfast.co.za';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const base  = `${proto}://${req.headers.host}`;

  // params (ASCII hyphen in item_name; no empties)
  const P = ordered({
    amount,
    cancel_url: `${base}/cancel.html`,
    custom_str1: whatsapp || undefined,
    custom_str2: plan || undefined,
    custom_str3: billingCycle || undefined,
    custom_str4: String(qty),
    email_address: email,
    item_name: `WeShare ${plan} - ${billingCycle}`,
    merchant_id,
    merchant_key,
    m_payment_id: `WS-${Date.now()}`,
    name_first: (email.split('@')[0] || 'WeShare'),
    name_last: 'Customer',
    notify_url: `${base}/api/payfast/ipn`,
    return_url: `${base}/success.html`,
  });

  // Build both variants
  const qPlus = qsPlus(P);                 // spaces as +
  const qPct  = qsPct(P);                  // spaces as %20
  const sigPlus = sign(qPlus, PASS);
  const sigPct  = sign(qPct,  PASS);

  const urlPlus = `${host}/eng/process?${qPlus}&signature=${sigPlus}`;
  const urlPct  = `${host}/eng/process?${qPct}&signature=${sigPct}`;

  // DEBUG: return both so we can try each
  if (String(req.query.debug) === '1') {
    return res.json({
      ok: true, env: forceSandbox ? 'sandbox' : 'live',
      plus: { url: urlPlus, q: qPlus, signature: sigPlus },
      pct:  { url: urlPct,  q: qPct,  signature: sigPct  }
    });
  }

  // Default to PLUS; if PCT is the one that works for you, switch this to urlPct and redeploy.
  return res.json({ ok: true, sandbox: forceSandbox, url: urlPlus });
};
