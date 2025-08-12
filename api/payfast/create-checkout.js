// api/payfast/create-checkout.js
// Works even without env vars: returns a MOCK url if PayFast keys are missing.
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { plan='youtube', quantity=1, billingCycle='monthly', email='test@example.com' } = req.body || {};

  // Pricing calc (same as frontend)
  const prices = { youtube:49, spotify:39, bundle:79 };
  const mult = { monthly:1, quarterly:0.95*3, yearly:0.88*12 };
  const qty = Math.max(1, Math.min(6, Number(quantity||1)));
  const amount = ((prices[plan]||49) * qty * (mult[billingCycle]||1)).toFixed(2);

  const MID = process.env.PAYFAST_MERCHANT_ID;
  const MK  = process.env.PAYFAST_MERCHANT_KEY;
  const PASS = process.env.PAYFAST_PASSPHRASE;

  // If any key missing -> return MOCK url (so you can test the route)
  if (!MID || !MK) {
    const mock = `https://mock.payfast.local/eng/process?amount=${amount}&item_name=${encodeURIComponent(qty+'x '+plan+' – '+billingCycle)}&email=${encodeURIComponent(email)}`;
    return res.status(200).json({ url: mock, mock: true });
  }

  // Real PayFast link if envs exist
  const HOST = process.env.NODE_ENV === 'production' ? 'https://www.payfast.co.za' : 'https://sandbox.payfast.co.za';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${proto}://${req.headers.host}`;

  const params = {
    merchant_id: MID,
    merchant_key: MK,
    return_url: process.env.RETURN_URL || (baseUrl + '/success.html'),
    cancel_url: process.env.CANCEL_URL || (baseUrl + '/cancel.html'),
    notify_url: process.env.NOTIFY_URL || (baseUrl + '/api/payfast/ipn'),
    name_first: 'WeShare',
    name_last: 'Customer',
    email_address: email,
    amount,
    item_name: `${qty}× ${plan} – ${billingCycle}`,
    custom_str2: plan,
    custom_str3: billingCycle,
    custom_str4: String(qty)
  };

  const sigStr = Object.keys(params).sort().map(k => `${k}=${encodeURIComponent(params[k]).replace(/%20/g,'+')}`).join('&') + (PASS ? `&passphrase=${encodeURIComponent(PASS)}` : '');
  const signature = crypto.createHash('md5').update(sigStr).digest('hex');
  const url = `${HOST}/eng/process?${new URLSearchParams({ ...params, signature }).toString()}`;
  return res.status(200).json({ url, mock: false });
}
