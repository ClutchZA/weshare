
// api/payfast/create-checkout.js
const crypto = require('crypto');
const fmtAmount = (n) => Number(n).toFixed(2);
const urlEnc = (v) => encodeURIComponent(String(v)).replace(/%20/g, '+');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { plan='youtube', quantity=1, billingCycle='monthly', email='', whatsapp='' } = req.body || {};
  const prices = { youtube: 49, spotify: 39, bundle: 79 };
  const cycles = { monthly: 1, quarterly: 3*0.95, yearly: 12*0.88 };

  const qty = Math.max(1, Math.min(6, parseInt(quantity || 1, 10)));
  const amount = fmtAmount((prices[plan] || 49) * qty * (cycles[billingCycle] || 1));

  const MID  = process.env.PAYFAST_MERCHANT_ID;
  const MK   = process.env.PAYFAST_MERCHANT_KEY;
  const PASS = process.env.PAYFAST_PASSPHRASE || '';
  const forceSandbox = (process.env.PAYFAST_ENV || '').toLowerCase() === 'sandbox';
  const isProd = process.env.NODE_ENV === 'production' && !forceSandbox;

  const host = isProd ? 'https://www.payfast.co.za' : 'https://sandbox.payfast.co.za';
  const merchant_id  = MID || '10000100';
  const merchant_key = MK  || '46f0cd694581a';

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const baseURL = `${proto}://${req.headers.host}`;
  const return_url = `${baseURL}/success.html`;
  const cancel_url = `${baseURL}/cancel.html`;
  const notify_url = `${baseURL}/api/payfast/ipn`;

  const m_payment_id = `WS-${Date.now()}`;

  const params = {
    merchant_id, merchant_key,
    return_url, cancel_url, notify_url,
    name_first: email ? email.split('@')[0] : 'WeShare',
    name_last: 'Customer',
    email_address: email || 'test@example.com',
    m_payment_id,
    amount,
    item_name: `WeShare ${plan} – ${billingCycle}`,
    custom_str1: whatsapp || '',
    custom_str2: plan,
    custom_str3: billingCycle,
    custom_str4: String(qty),
  };

  const sigKeys = Object.keys(params).sort();
  let sigStr = sigKeys.map(k => `${k}=${urlEnc(params[k])}`).join('&');
  if (PASS) sigStr += `&passphrase=${urlEnc(PASS)}`;
  const signature = crypto.createHash('md5').update(sigStr).digest('hex');

  const url = `${host}/eng/process?` + new URLSearchParams({ ...params, signature }).toString();
  const usingSandbox = merchant_id === '10000100';
  return res.status(200).json({ ok: true, url, sandbox: !isProd || usingSandbox, m_payment_id });
};
