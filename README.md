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

## Check
- yoursite.vercel.app/asta.gif should show the image. If it is a 404, the file is not in the project root.
- yoursite.vercel.app/api/bc?a=list should return {"posts":[]} once Redis is connected.
