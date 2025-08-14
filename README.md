# WeShare — Full Working Site (Vercel + Node 18)
Modern UI + serverless PayFast endpoint (mock until keys set).

## Deploy
1) Upload ALL files to your GitHub repo root.
2) Vercel → Settings → Build & Output:
   - Framework Preset: Other
   - Build Command: (leave empty)
   - Output Directory: (leave empty)
3) Redeploy.

## Test
- / -> UI loads
- /api/hello -> JSON
- Click "Pay by Card" -> mock URL (until keys present)

## Go Live (PayFast)
Add env vars in Vercel:
- PAYFAST_MERCHANT_ID
- PAYFAST_MERCHANT_KEY
- PAYFAST_PASSPHRASE
Redeploy. Then checkout redirects to PayFast.

