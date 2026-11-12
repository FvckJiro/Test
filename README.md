# BlackClover site: Vercel setup

Files (keep this layout, all in the project root):

    index.html
    asta.gif
    package.json
    api/bc.js

## Deploy
1. Put these files in a GitHub repo (index.html at the root of the repo, not inside another folder).
2. On vercel.com: Add New > Project > import the repo. Framework preset: Other. Leave Build Command and Output Directory empty. Deploy.

## Turn on community posting (required for Scripts and Admin)
1. Vercel project > Storage > Create Database > Upstash Redis (free plan). Connect it to the project. This adds the KV_REST_API_URL and KV_REST_API_TOKEN variables.
2. Project > Settings > Environment Variables > add ADMIN_PASSWORD with a long password only you know.
3. Deployments > Redeploy.

## Use it
- Admin panel: yoursite.vercel.app/#admin (or the Admin link in the footer).
- Approve or reject new posts, verify authors, delete posts.
- Read every script before you approve it.

## Edit in index.html (CONFIG block near the bottom)
- discord, keyLink (your key checkpoint link), buyLink, freePrice, premiumPrice
- verifyViews / verifyLikes: the bar the admin panel uses to flag authors for Verified

## Accounts, profiles, dashboard
- People create an account at /#login, then post scripts, edit their profile (picture, banner, bio, accent color) and manage posts at /#dashboard.
- Public profiles live at /#u/USERNAME.
- Names that posted before accounts existed can log in with their old name and password.
- Login, register and admin attempts are rate limited per IP.

## Key checkpoint
- /#getkey: the visitor picks their hours (3h, 6h, 12h, 1 day, 4 days), then sees one card per checkpoint with a progress ring and a side list. Start opens the link, a timer runs, then Continue. After the last one the server issues a key like BC-XXXX-XXXX-XXXX.
- Edit CONFIG.tiers in index.html: one link per checkpoint, so the number of links is the number of checkpoints.
- The same ids and checkpoint counts live in TIERS at the top of api/bc.js (id -> hours h, checkpoints n). Change both together.
- Optional env var: CHECKPOINT_WAIT seconds per checkpoint (default 12).
- Verify a key from your loader: GET /api/bc?a=check&k=KEY returns {"valid":true,"exp":...} or {"valid":false}.
- The timer cannot prove someone really finished a third-party link. Keep that in mind for ad revenue.

## Check
- yoursite.vercel.app/asta.gif should show the image. If it is a 404, the file is not in the project root.
- yoursite.vercel.app/api/bc?a=list should return {"posts":[]} once Redis is connected.
