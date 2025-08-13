# WeShare — Best Route (Vercel + Node 18)
Static UI + Vercel serverless API with PayFast mock fallback.

Deploy:
1) Upload all files to your GitHub repo root.
2) Vercel → Settings → Build & Output: Framework=Other, Build Command=empty, Output Directory=empty.
3) Redeploy. Test /api/hello and the button.

Go live:
Add env vars in Vercel:
- PAYFAST_MERCHANT_ID
- PAYFAST_MERCHANT_KEY
- PAYFAST_PASSPHRASE
