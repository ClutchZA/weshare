// api/payfast/create-checkout.js
const crypto = require('crypto');

const money = (n) => Number(n).toFixed(2);
const enc = (v) => encodeURIComponent(String(v)); // => spaces = %20

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { plan='youtube', quantity=1, billingCycle='monthly', email='', whatsapp='' } = req.body || {};
  const prices = { youtube: 49, spotify: 39, bundle: 79 };
  const cycles  = { monthly: 1, quarterly: 3*0.95, yearly: 12*0.88 };

  const qty = Math.max(1, Math.min(6, parseInt(quantity || 1, 10)));
  const amount = money((prices[plan] || 49) * qty * (cycles[billingCycle] || 1));

  const forceSandbox = (process.env.PAYFAST_ENV || '').toLowerCase() === 'sandbox';
  const MID  = process.env.PAYFAST_MERCHANT_ID;
  const MK   = process.env.PAYFAST_MERCHANT_KEY;
  const PASS = (process.env.PAYFAST_PASSPHRASE || '').trim();

  const host = forceSandbox ? 'https://sandbox.payfast.co.za' : 'https://www.payfast.co.za';
  const merchant_id  = forceSandbox ? '10000100'      : MID;
  const merchant_key = forceSandbox ? '46f0cd694581a' : MK;
  if (!merchant_id || !merchant_key) return res.status(500).json({ error: 'Missing PayFast credentials' });

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const base  = `${proto}://${req.headers.host}`;

  const params = {
    merchant_id,
    merchant_key,
    return_url: `${base}/success.html`,
    cancel_url: `${base}/cancel.html`,
    notify_url: `${base}/api/payfast/ipn`,
    name_first: email ? email.split('@')[0] : 'WeShare',
    name_last:  'Customer',
    email_address: email || 'test@example.com',
    m_payment_id: `WS-${Date.now()}`,
    amount,
    item_name: `WeShare ${plan} - ${billingCycle}`, // ASCII hyphen
    custom_str1: whatsapp || undefined,
    custom_str2: plan || undefined,
    custom_str3: billingCycle || undefined,
    custom_str4: String(qty),
  };
  // remove empty
  Object.keys(params).forEach(k => (params[k] === '' || params[k] == null) && delete params[k]);

  // sort keys for signing
  const keys = Object.keys(params).sort();

  // build the EXACT string PayFast expects (spaces as %20)
  const query = keys.map(k => `${k}=${enc(params[k])}`).join('&');

  // signature = encoded string (+ passphrase only in LIVE)
  let sigStr = query;
  if (!forceSandbox && PASS) sigStr += `&passphrase=${enc(PASS)}`;
  const signature = crypto.createHash('md5').update(sigStr).digest('hex');

  const url = `${host}/eng/process?${query}&signature=${signature}`;
  return res.status(200).json({ ok: true, sandbox: forceSandbox, url, m_payment_id: params.m_payment_id });
};
