// api/payfast/create-checkout.js
const crypto = require('crypto');

const money = n => Number(n).toFixed(2);
const enc = v => encodeURIComponent(String(v)); // spaces => %20

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { plan='youtube', quantity=1, billingCycle='monthly', email='', whatsapp='' } = req.body || {};

  // pricing
  const prices = { youtube: 49, spotify: 39, bundle: 79 };
  const cycles  = { monthly: 1, quarterly: 3*0.95, yearly: 12*0.88 };
  const qty = Math.max(1, Math.min(6, parseInt(quantity || 1, 10)));
  const amount = money((prices[plan] || 49) * qty * (cycles[billingCycle] || 1));

  // env
  const forceSandbox = (process.env.PAYFAST_ENV || '').toLowerCase() === 'sandbox';
  const PASS = (process.env.PAYFAST_PASSPHRASE || '').trim();
  const merchant_id  = forceSandbox ? '10000100'      : process.env.PAYFAST_MERCHANT_ID;
  const merchant_key = forceSandbox ? '46f0cd694581a' : process.env.PAYFAST_MERCHANT_KEY;
  if (!merchant_id || !merchant_key) return res.status(500).json({ error: 'Missing PayFast credentials' });

  const host = forceSandbox ? 'https://sandbox.payfast.co.za' : 'https://www.payfast.co.za';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const base  = `${proto}://${req.headers.host}`;

  // params (no empty values, ASCII hyphen only)
  const p = {
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

  // remove empties
  Object.keys(p).forEach(k => (p[k] === '' || p[k] == null) && delete p[k]);

  // Build query in **alphabetical key order**
  const keys = Object.keys(p).sort();
  const query = keys.map(k => `${k}=${enc(p[k])}`).join('&');

  // Signature over the **same** string (+ passphrase in LIVE only)
  let sigStr = query;
  if (!forceSandbox && PASS) sigStr += `&passphrase=${enc(PASS)}`;
  const signature = crypto.createHash('md5').update(sigStr).digest('hex');

  const url = `${host}/eng/process?${query}&signature=${signature}`;

  // Optional debug to help if anything still fails:
  // return res.json({ ok: true, sandbox: forceSandbox, url, query, sigStr, signature });

  return res.json({ ok: true, sandbox: forceSandbox, url });
};
