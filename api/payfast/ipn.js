
// api/payfast/ipn.js
const crypto = require('crypto');
const urlEnc = (v) => encodeURIComponent(String(v)).replace(/%20/g, '+');

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const raw = await readRawBody(req);
    const params = Object.fromEntries(new URLSearchParams(raw));
    const { signature: sigFromPF = '' } = params;

    const sigParams = { ...params };
    delete sigParams.signature;
    const sigStr = Object.keys(sigParams)
      .sort()
      .map((k) => `${k}=${urlEnc(sigParams[k])}`)
      .join('&') + (process.env.PAYFAST_PASSPHRASE ? `&passphrase=${urlEnc(process.env.PAYFAST_PASSPHRASE)}` : '');
    const ourSig = crypto.createHash('md5').update(sigStr).digest('hex');
    const sigOk = ourSig === sigFromPF.toLowerCase();

    const forceSandbox = (process.env.PAYFAST_ENV || '').toLowerCase() === 'sandbox';
    const isProd = process.env.NODE_ENV === 'production' && !forceSandbox;
    const host = isProd ? 'https://www.payfast.co.za' : 'https://sandbox.payfast.co.za';

    const validateRes = await fetch(`${host}/eng/query/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: raw,
    });
    const validateText = (await validateRes.text()).trim();
    const pfValid = validateText === 'VALID';

    const gross = parseFloat(params.amount_gross || params.amount || '0') || 0;
    const amtOk = gross > 0; // TODO: verify against your DB for m_payment_id

    const ok = sigOk && pfValid && amtOk;
    console.log('PayFast ITN:', { m_payment_id: params.m_payment_id, payment_status: params.payment_status, sigOk, pfValid, amtOk, gross });

    return res.status(200).send(ok ? 'OK' : 'INVALID');
  } catch (err) {
    console.error('PayFast ITN handler error:', err);
    return res.status(200).send('ERROR');
  }
};
