// api/payfast/ipn.js
const crypto = require('crypto');
const enc = (v) => encodeURIComponent(String(v)); // spaces = %20

function readRawBody(req){
  return new Promise((resolve, reject)=>{
    let data=''; req.on('data', c=>data+=c); req.on('end', ()=>resolve(data)); req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  try {
    const raw = await readRawBody(req);
    const params = Object.fromEntries(new URLSearchParams(raw));
    const sigFromPF = (params.signature || '').toLowerCase();
    delete params.signature;

    const keys = Object.keys(params).sort();
    let sigStr = keys.map(k => `${k}=${enc(params[k])}`).join('&');
    const PASS = (process.env.PAYFAST_PASSPHRASE || '').trim();
    const forceSandbox = (process.env.PAYFAST_ENV || '').toLowerCase() === 'sandbox';
    if (!forceSandbox && PASS) sigStr += `&passphrase=${enc(PASS)}`;

    const ourSig = crypto.createHash('md5').update(sigStr).digest('hex');
    const sigOk = ourSig === sigFromPF;

    const host = forceSandbox ? 'https://sandbox.payfast.co.za' : 'https://www.payfast.co.za';
    const validate = await fetch(`${host}/eng/query/validate`, {
      method: 'POST',
      headers: { 'Content-Type':'application/x-www-form-urlencoded' },
      body: raw,
    }).then(r=>r.text());
    const pfValid = validate.trim() === 'VALID';

    // amount check TODO
    const gross = parseFloat(params.amount_gross || params.amount || '0') || 0;
    const amtOk = gross > 0;

    const ok = sigOk && pfValid && amtOk;
    console.log('PayFast ITN:', { sigOk, pfValid, amtOk, payment_status: params.payment_status, m_payment_id: params.m_payment_id });

    return res.status(200).send(ok ? 'OK' : 'INVALID');
  } catch (e) {
    console.error('IPN error', e);
    return res.status(200).send('ERROR');
  }
};
