# Instagram Viewer & Blocker

Chrome and Firefox extension to view profiles and block any Instagram account — even ones that have already blocked you.

## What it does

Instagram hides profiles from you when someone blocks you. Instagram Viewer & Blocker bypasses that in both directions:

- **Profile Info** — view full profile data for any account regardless of block status
- **Block** — block any account even if they blocked you first

## Features

- **Profile lookup** — username, full name, bio, external link, profile picture, follower/following/post counts, verified badge, private flag
- **Works when blocked** — anonymous API fallbacks strip session cookies so Instagram's block relationship doesn't apply
- **One-click block** — username auto-fills from the active tab URL; ID resolution happens silently in the background
- **Self-block prevention** — detects and rejects attempts to block your own account
- **No external server** — all requests go directly to Instagram; credentials never leave your browser

## How it works

### Profile lookup (3 methods, tried in order)
1. Authenticated `web_profile_info` API — fast, works for normal accounts
2. Same API without cookies (`credentials: 'omit'`) — Instagram sees anonymous visitor, block relationship doesn't apply
3. Anonymous full-page HTML fetch — parses Relay store JSON blobs and meta description tags embedded in the public page

### Blocking
Calls Instagram's internal GraphQL mutation (`usePolarisBlockManyMutation`) — the same request Instagram's own UI fires.

### User ID resolution (5 methods, tried in order)
1. `web_profile_info` API
2. `topsearch` API — works even when target blocked you
3. `users/search` API
4. Legacy `?__a=1` endpoint
5. Anonymous page fetch — parses user ID from embedded JSON in the public HTML response

## Install

### Chrome
1. Clone [this repo](https://github.com/husanboymurodov/instagram-viewer-blocker)
2. Go to `chrome://extensions` → enable **Developer Mode**
3. Click **Load unpacked** → select the repo folder

### Firefox (109+)
1. Clone [this repo](https://github.com/husanboymurodov/instagram-viewer-blocker)
2. Go to `about:debugging` → **This Firefox** → **Load Temporary Add-on**
3. Navigate into the repo folder and select **`manifest.json`**

## Usage

| Action | Steps |
|--------|-------|
| View profile info | Type username → **Profile Info** |
| Block from a profile page | Open profile → click extension icon → username auto-fills → **Block** |
| Block by username | Click extension icon → type username → **Block** |

**Profile Info shows:**
- Username (with 🔒 private / ✓ verified badges)
- Full name
- Bio
- External link
- Profile picture
- User ID
- Followers / Following / Posts

## Notes

- Must be logged into Instagram in the same browser
- Cannot block yourself — the extension detects and prevents this
- `DOC_ID` in `content.js` is tied to Instagram's current deploy — if blocking stops working, capture a fresh `usePolarisBlockManyMutation` request from the Network tab and update the value
- If you see "Could not fetch profile — try reloading the Instagram tab", do so once

## Privacy

No data collected. [Privacy Policy](https://husanboymurodov.github.io/instagram-viewer-blocker/privacy-policy.html)

## Stack

Vanilla JS · Chrome / Firefox · Manifest V3 · Instagram private GraphQL API
