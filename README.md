# WeShare — Full Ready Build

Static UI + serverless PayFast endpoints (mock fallback) + success/cancel pages.

## Deploy
1) Upload the *contents* of this folder to your GitHub repo root.
2) Import to Vercel → Framework: Other, Build Command: (empty), Output Directory: (empty).
3) Visit your site. The UI posts to `/api/payfast/create-checkout`.
   - Without env vars, it returns a **mock URL** (proves API is live).
   - Add env vars and redeploy to get **real PayFast** URLs.

## Env vars (Vercel → Project → Settings → Environment Variables)
PAYFAST_MERCHANT_ID=xxxx
PAYFAST_MERCHANT_KEY=xxxx
PAYFAST_PASSPHRASE=xxxx
# optional overrides
RETURN_URL=https://your-domain/success.html
CANCEL_URL=https://your-domain/cancel.html
NOTIFY_URL=https://your-vercel-app.vercel.app/api/payfast/ipn

## Handy routes
GET /api/hello
POST /api/payfast/create-checkout
POST /api/payfast/ipn (stub)
GET /api/worker-fulfilment (stub)
GET /api/worker-renewals (stub)
