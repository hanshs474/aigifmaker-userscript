# AI GIF Maker userscript: selected text to an animated GIF

Turn text into animated GIFs with AI GIF Maker. Native GIF generation — no video conversion. Type what you want and download your GIF in about a minute.

This is the official userscript for [AI GIF Maker](https://aigifmaker.ai/?utm_source=greasyfork&utm_medium=userscript). Select some text on any page, click the small **GIF** button (or pick **Make a GIF from the selected text** from the userscript menu), press **Make GIF**, and the finished GIF shows in a panel on the page with a link to open or save it. Nothing is sent until you press **Make GIF**.

## Install

Install from Greasy Fork, or open `aigifmaker.user.js` in Tampermonkey / Violentmonkey. Then choose **Set AI GIF Maker API key…** from the userscript menu and paste a key from https://aigifmaker.ai/settings/apikeys. The key is kept in the userscript manager's storage (`GM_setValue`).

Each GIF costs 1 credit on your AI GIF Maker account, the same as on the website. New accounts get one free GIF (it carries a small aigifmaker.ai badge), and a failed GIF gives its credit back. Credit packs are on the [pricing](https://aigifmaker.ai/pricing?utm_source=greasyfork&utm_medium=userscript) page.

## What it sends

Only to `https://aigifmaker.ai` (`@connect aigifmaker.ai`): the selected text and your key to `/api/ai/generate`, then the task id to `/api/ai/query` every 3 seconds until the GIF is ready. No analytics, no other hosts.

`node test/run.mjs --live` checks the error mapping and, against the live site, that a wrong key and a missing key both end on the API-key message (nothing is generated).

MIT licensed. Questions: support@aigifmaker.ai.
