# Instagram Blocker

Chrome and Firefox extension to block any Instagram account by username — including accounts that have already blocked you.

## Features

- **One-click block** — open popup on any profile, username auto-fills, click Block
- **Works when blocked** — if they blocked you first, Instagram hides their profile; this extension bypasses that
- **Profile Info** — reveals user ID, follower count, following count, and post count for any account, even blocked ones
- **Private account detection** — shows 🔒 and "Private" instead of blank dashes for private accounts
- **Graceful error messages** — expired DOC_ID, connection issues, and private accounts all surface clear messages
- **Fully automatic** — user only ever types a username; ID resolution and blocking happen in the background

## How it works

### Blocking
Calls Instagram's internal GraphQL mutation (`usePolarisBlockManyMutation`) — the same request Instagram's own UI fires. No external server. Credentials never leave your browser.

### User ID resolution (5 methods, tried in order)
1. `web_profile_info` API — fast, works for normal accounts
2. `topsearch` API — works even when target blocked you
3. `users/search` API — second fallback
4. Legacy `?__a=1` endpoint — third fallback
5. **Anonymous page fetch** (`credentials: 'omit'`) — strips session cookies so Instagram sees no block relationship; parses user ID from embedded JSON in the public HTML response

### Profile Info (followers / following / posts)
1. Authenticated `web_profile_info` — fails for blocked accounts
2. **Same API without cookies** — Instagram treats it as an anonymous visitor, returns full public data including counts
3. Anonymous HTML parse — traverses Relay store JSON blobs embedded in page scripts
4. Meta description fallback — Instagram writes `"X Followers, Y Following, Z Posts"` in `<meta>` tags for anonymous visitors

## Install

### Chrome
1. Clone this repo
2. Go to `chrome://extensions` → enable **Developer Mode**
3. Click **Load unpacked** → select the repo folder

### Firefox (128+)
1. Clone this repo
2. Go to `about:debugging` → **This Firefox** → **Load Temporary Add-on**
3. Select any file inside the repo folder

> **Note:** If you see "Refresh the Instagram tab", do so once. This happens when the tab was open before the extension loaded.

## Usage

| Action | Steps |
|--------|-------|
| Block from a profile page | Open profile → click extension icon → username auto-fills → **Block** |
| Block by username | Click extension icon → type username → **Block** |
| Look up profile info | Type username → **Profile Info** |

**Profile Info shows:**
- Username
- User ID
- Followers
- Following
- Posts

## Notes

- Must be logged into Instagram in the same browser
- `DOC_ID` in `content.js` is tied to Instagram's current deploy — if blocking stops working, the extension will display a clear error message; capture a fresh `usePolarisBlockManyMutation` request from the Network tab and update the value
- If you see "Refresh the Instagram tab", do so once — happens when the tab was open before the extension loaded
- Private accounts show 🔒 in Profile Info; follower/following/post counts display as "Private"

## Privacy

This extension collects no data. [Privacy Policy](https://husanboymurodov.github.io/instagram-blocker/privacy-policy.html)

## Stack

Vanilla JS · Chrome / Firefox Extension Manifest V3 · Instagram private GraphQL API
