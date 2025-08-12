import crypto from 'crypto';
export default async function handler(req,res){
  try{
    if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
    const {plan,quantity,billingCycle,email,whatsapp}=req.body||{};
    if(!plan||!quantity||!billingCycle||!email) return res.status(400).json({error:'Missing fields'});
    const prices={youtube:49,spotify:39,bundle:79};
    const mult={monthly:1,quarterly:0.95*3,yearly:0.88*12};
    if(!prices[plan]||!mult[billingCycle]) return res.status(400).json({error:'Invalid plan/cycle'});
    const qty=Math.max(1,Math.min(6,Number(quantity)));
    const amount=(prices[plan]*qty*mult[billingCycle]).toFixed(2);
    const MID=process.env.PAYFAST_MERCHANT_ID, MK=process.env.PAYFAST_MERCHANT_KEY, PASS=process.env.PASSPHRASE||process.env.PAYFAST_PASSPHRASE;
    const HOST=process.env.NODE_ENV==='production'?'https://www.payfast.co.za':'https://sandbox.payfast.co.za';
    const proto=req.headers['x-forwarded-proto']||'https'; const base=`${proto}://${req.headers.host}`;
    const params={merchant_id:MID,merchant_key:MK,return_url:process.env.RETURN_URL||base+'/success.html',cancel_url:process.env.CANCEL_URL||base+'/cancel.html',notify_url:process.env.NOTIFY_URL||base+'/api/payfast/ipn',name_first:'WeShare',name_last:'Customer',email_address:email,amount,item_name:`${qty}× ${plan} – ${billingCycle}`,custom_str1:whatsapp||'',custom_str2:plan,custom_str3:billingCycle,custom_str4:String(qty)};
    const sigStr=Object.keys(params).sort().map(k=>`${k}=${encodeURIComponent(params[k]).replace(/%20/g,'+')}`).join('&')+(PASS?`&passphrase=${encodeURIComponent(PASS)}`:'');
    const signature=crypto.createHash('md5').update(sigStr).digest('hex');
    const url=`${HOST}/eng/process?`+new URLSearchParams({...params,signature}).toString();
    res.status(200).json({url});
  }catch(e){res.status(500).json({error:e.message||'server error'})}
}