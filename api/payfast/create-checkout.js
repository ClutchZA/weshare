// api/payfast/checkout-fields.js
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
function qsPlus(obj) {               // form urlencoded (spaces => +)
  const u = new URLSearchParams();
  for (const [k,v] of Object.entries(obj)) u.append(k, v);
  return u.toString();
}
function sign(base, pass) {
  const s = pass ? `${base}&passphrase=${enc(pass)}` : base;
  return crypto.createHash('md5').update(s).digest('hex');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { plan='youtube', billingCycle='monthly', quantity=1, email='test@example.com' } = req.body || {};

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

  if (!merchant_id || !merchant_key) return res.status(500).json({ error:'Missing PayFast credentials' });

  const host  = isSandbox ? 'https://sandbox.payfast.co.za' : 'https://www.payfast.co.za';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const base  = `${proto}://${req.headers.host}`;

  // *** Minimal set of fields (recommended to isolate signature issues) ***
  const FIELDS = ordered({
    merchant_id,
    merchant_key,
    amount,
    item_name: `WeShare ${plan} - ${billingCycle}`, // ASCII hyphen
    return_url: `${base}/success.html`,
    cancel_url: `${base}/cancel.html`,
    notify_url: `${base}/api/payfast/ipn`,
    // optional (add later once this works)
    // m_payment_id: `WS-${Date.now()}`,
    // email_address: email,
  });

  // Build the form-encoded string (spaces => '+') and sign it
  const query = qsPlus(FIELDS);
  const signature = sign(query, PASS);

  return res.json({
    ok: true,
    sandbox: isSandbox,
    host,
    // include signature as a field – PayFast expects it as one more POST field
    fields: { ...FIELDS, signature },
    debug: { query, signature } // helpful for inspection
  });
};
