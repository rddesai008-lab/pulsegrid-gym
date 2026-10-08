# PulseGrid Gym Management SaaS

Run locally with:

```bash
npm start
```

Open `http://localhost:3000` for the IronPeak admin dashboard, or
`http://localhost:3000/join/ironpeak` for the tenant-branded public join flow.

The app uses a tenant-scoped Node backend and persists runtime records to
`data.json`. A successful join creates or renews a member and writes its
payment, invoice, and audit entry into the same data store that powers the
dashboard.

The checkout is deliberately a safe local payment simulation. To go live,
replace the `POST /api/public/join` success branch with Razorpay order creation
and webhook signature verification; call the existing data-writing logic only
after a verified `payment.captured` webhook. Confirmation buttons are similarly
ready to be connected to a transactional provider with tenant credentials.

## Free hosting

This project can be deployed as a Node web service on Render, Railway, Koyeb,
or any similar provider. The required settings are:

| Setting | Value |
| --- | --- |
| Runtime | Node.js 22+ |
| Build command | `npm install` |
| Start command | `npm start` |
| Port | Supplied automatically by the hosting provider through `PORT` |

For Render, connect the repository and it will use `render.yaml` automatically.

> The included `data.json` store is for a demo only. Most free hosting plans
> have ephemeral storage, so records can be reset when the service restarts.
> Use a managed Postgres database before collecting real member or payment data.

### Netlify

1. Create a new Netlify site from your GitHub repository, or drag the project
   folder into Netlify's manual deploy area.
2. Netlify reads `netlify.toml` automatically: the website is served from
   `public/` and the API runs through `netlify/functions/api.js`.
3. After deployment, visit `/` for the dashboard and `/join/ironpeak` for the
   public sign-up flow.

For a Netlify deployment, member and payment changes are kept only while a
serverless function remains warm. Connect Supabase or Neon Postgres before
using it for real gym operations.
