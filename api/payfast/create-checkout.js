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
function qsPlus(obj) {                      // spaces => '+'
  const u = new URLSearchParams();
  for (const [k,v] of Object.entries(obj)) u.append(k, v);
  return u.toString();
}
function qsPct(obj) {                       // spaces => '%20'
  return Object.entries(obj).map(([k,v]) => `${k}=${enc(v)}`).join('&');
}
function sign(base, pass) {                 // append passphrase ONLY in LIVE
  const s = pass ? `${base}&passphrase=${enc(pass)}` : base;
  return crypto.createHash('md5').update(s).digest('hex');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error:'Method not allowed' });

  const body = req.body || {};
  const { plan='youtube', quantity=1, billingCycle='monthly', email='test@example.com', whatsapp='' } = body;

  // choose test mode via query params
  const mode   = (req.query.mode   || 'full').toString();   // 'full' | 'min'
  const encode = (req.query.encode || 'plus').toString();   // 'plus' | 'pct'
  const debug  = String(req.query.debug || '0') === '1';

  // pricing
  const prices = { youtube:49, spotify:39, bundle:79 };
  const cycles = { monthly:1, quarterly:3*0.95, yearly:12*0.88 };
  const qty    = Math.max(1, Math.min(6, parseInt(quantity || 1, 10)));
  const amount = money((prices[plan] || 49) * qty * (cycles[billingCycle] || 1));

  // env
  const isSandbox   = (process.env.PAYFAST_ENV || '').toLowerCase() === 'sandbox';
  const merchant_id = isSandbox ? '10000100'      : process.env.PAYFAST_MERCHANT_ID;
  const merchant_key= isSandbox ? '46f0cd694581a' : process.env.PAYFAST_MERCHANT_KEY;
  const PASS        = !isSandbox ? (process.env.PAYFAST_PASSPHRASE || '').trim() : '';

  if (!merchant_id || !merchant_key) {
    return res.status(500).json({ error:'Missing PayFast credentials' });
  }

  const host  = isSandbox ? 'https://sandbox.payfast.co.za' : 'https://www.payfast.co.za';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const base  = `${proto}://${req.headers.host}`;

  // ----- PARAMS -----
  let P;
  if (mode === 'min') {
    // minimal fields (good for isolating signature problems)
    P = ordered({
      merchant_id, merchant_key, amount,
      item_name: `WeShare ${plan} - ${billingCycle}`,     // ASCII hyphen
      return_url: `${base}/success.html`,
      cancel_url: `${base}/cancel.html`,
      notify_url: `${base}/api/payfast/ipn`,
    });
  } else {
    // full set
    P = ordered({
      amount,
      cancel_url: `${base}/cancel.html`,
      custom_str1: whatsapp || undefined,
      custom_str2: plan || undefined,
      custom_str3: billingCycle || undefined,
      custom_str4: String(qty),
      email_address: email,
      item_name: `WeShare ${plan} - ${billingCycle}`,     // ASCII hyphen
      merchant_id,
      merchant_key,
      m_payment_id: `WS-${Date.now()}`,
      name_first: (email.split('@')[0] || 'WeShare'),
      name_last: 'Customer',
      notify_url: `${base}/api/payfast/ipn`,
      return_url: `${base}/success.html`,
    });
  }

  // ----- ENCODING & SIGNATURE -----
  const build = encode === 'pct' ? qsPct : qsPlus; // choose encoding
  const query = build(P);
  const sig   = sign(query, PASS);
  const url   = `${host}/eng/process?${query}&signature=${sig}`;

  if (debug) {
    // return everything we used so you can copy/paste and try
    return res.json({
      ok: true,
      env: isSandbox ? 'sandbox' : 'live',
      mode, encode,
      query, sigStr: PASS && !isSandbox ? `${query}&passphrase=${encodeURIComponent(PASS)}` : query,
      signature: sig,
      url
    });
  }

  return res.json({ ok: true, sandbox: isSandbox, url });
};
