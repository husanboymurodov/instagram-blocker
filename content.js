// Runs on instagram.com — handles block requests from the popup only.
/* global browser */
const _chrome = typeof browser !== 'undefined' ? browser : chrome; // Firefox / Chrome compat

const DOC_ID = '27585081607756220'; // usePolarisBlockManyMutation — refresh if Instagram redeploys

function getCookie(name) {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function extractPageToken(dataKey) {
  for (const script of document.scripts) {
    const m = script.text.match(new RegExp(`"${dataKey}"[^}]{0,200}"token":"([^"]+)"`));
    if (m) return m[1];
  }
  return null;
}

async function resolveUserId(username) {
  // Method 1: profile info API
  try {
    const r = await fetch(`/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`, {
      headers: { 'x-ig-app-id': '936619743392459' }
    });
    const d = await r.json();
    const id = d?.data?.user?.id;
    if (id) return id;
  } catch {}

  // Method 2: top-search (works even when target blocked you)
  try {
    const r = await fetch(`/web/search/topsearch/?query=${encodeURIComponent(username)}&context=blended&count=10`);
    const d = await r.json();
    const u = d.users?.find(u => u.user.username.toLowerCase() === username.toLowerCase());
    if (u?.user?.pk) return u.user.pk;
  } catch {}

  // Method 3: user search API
  try {
    const r = await fetch(`/api/v1/users/search/?query=${encodeURIComponent(username)}&count=10`, {
      headers: { 'x-ig-app-id': '936619743392459' }
    });
    const d = await r.json();
    const u = d.users?.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (u?.pk) return u.pk;
  } catch {}

  // Method 4: legacy ?__a=1 endpoint
  try {
    const r = await fetch(`/${encodeURIComponent(username)}/?__a=1&__d=dis`);
    const d = await r.json();
    const id = d?.graphql?.user?.id || d?.data?.user?.id;
    if (id) return id;
  } catch {}

  // Method 5: anonymous page fetch — credentials: 'omit' strips session cookies.
  // Instagram sees an unauthenticated visitor → block relationship doesn't apply
  // → full profile HTML returned → parse user ID from embedded JSON.
  try {
    const r = await fetch(`/${encodeURIComponent(username)}/`, { credentials: 'omit' });
    if (r.ok) {
      const html = await r.text();
      const id = parseUserIdFromHtml(html, username);
      if (id) return id;
    }
  } catch {}

  return null;
}

function parseUserIdFromHtml(html, username) {
  // Instagram embeds profile data in <script type="application/json"> blocks.
  // User ID appears as "pk":"DIGITS" (primary key) inside those JSON blobs.
  // We also try username-anchored patterns to avoid false positives.

  const anchored = [
    new RegExp(`"username"\\s*:\\s*"${username}"[^}]{0,300}"pk"\\s*:\\s*"(\\d{7,})"`),
    new RegExp(`"pk"\\s*:\\s*"(\\d{7,})"[^}]{0,300}"username"\\s*:\\s*"${username}"`),
    new RegExp(`"username"\\s*:\\s*"${username}"[^}]{0,300}"id"\\s*:\\s*"(\\d{7,})"`),
    new RegExp(`"id"\\s*:\\s*"(\\d{7,})"[^}]{0,300}"username"\\s*:\\s*"${username}"`),
  ];
  for (const p of anchored) {
    const m = html.match(p);
    if (m) return m[1];
  }

  // Fallback: first "pk" value inside a <script type="application/json"> block
  const jsonBlocks = html.match(/<script type="application\/json"[^>]*>([\s\S]*?)<\/script>/g) ?? [];
  for (const block of jsonBlocks) {
    const m = block.match(/"pk"\s*:\s*"(\d{7,})"/);
    if (m) return m[1];
  }

  // Last resort: profilePage_ pattern (older Instagram builds)
  const legacy = html.match(/profilePage_(\d{7,})/);
  if (legacy) return legacy[1];

  return null;
}

async function blockById(targetUserId) {
  const csrftoken = getCookie('csrftoken');
  const dsUserId  = getCookie('ds_user_id');
  const fbDtsg    = extractPageToken('DTSGInitialData') ?? extractPageToken('DTSGInitData');
  const lsd       = extractPageToken('LSD');

  if (!csrftoken || !fbDtsg || !lsd) {
    throw new Error(`Missing tokens — csrftoken:${!!csrftoken} fb_dtsg:${!!fbDtsg} lsd:${!!lsd}`);
  }

  const body = new URLSearchParams({
    av: dsUserId ?? '0',
    __d: 'www',
    __user: dsUserId ?? '0',
    __a: '1',
    __req: '1',
    dpr: '1',
    __ccg: 'EXCELLENT',
    fb_dtsg: fbDtsg,
    lsd,
    fb_api_caller_class: 'RelayModern',
    fb_api_req_friendly_name: 'usePolarisBlockManyMutation',
    variables: JSON.stringify({ target_user_ids: [String(targetUserId)] }),
    server_timestamps: 'true',
    doc_id: DOC_ID,
  });

  const resp = await fetch('/graphql/query/', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'x-csrftoken': csrftoken,
      'x-fb-lsd': lsd,
      'x-ig-app-id': '936619743392459',
      'x-fb-friendly-name': 'usePolarisBlockManyMutation',
      'x-root-field-name': 'xdt_block_many',
    },
    body: body.toString(),
  });

  if (resp.status === 400 || resp.status === 404) {
    throw new Error('Block request rejected — DOC_ID likely expired. Capture a fresh request from Network tab and update DOC_ID in content.js.');
  }
  const json = await resp.json();
  if (json.status !== 'ok') {
    const hint = (json.message || '').toLowerCase().includes('doc')
      ? ' (DOC_ID may be expired)'
      : '';
    throw new Error(`Block failed${hint}: ${json.message ?? JSON.stringify(json)}`);
  }
  return json;
}

async function fetchProfile(username) {
  const enc = encodeURIComponent(username);

  // Method 1: authenticated API — works for accounts that haven't blocked you
  try {
    const r = await fetch(`/api/v1/users/web_profile_info/?username=${enc}`, {
      headers: { 'x-ig-app-id': '936619743392459' },
    });
    const d = (await r.json())?.data?.user;
    if (d?.id) return profileFromApiUser(d);
  } catch {}

  // Method 2: same API endpoint but NO cookies — Instagram sees anonymous visitor,
  // block relationship doesn't apply, returns full public profile data with counts
  try {
    const r = await fetch(`/api/v1/users/web_profile_info/?username=${enc}`, {
      credentials: 'omit',
      headers: { 'x-ig-app-id': '936619743392459' },
    });
    const d = (await r.json())?.data?.user;
    if (d?.id) return profileFromApiUser(d);
  } catch {}

  // Method 3: anonymous full-page HTML fetch — parse Relay store JSON blobs
  try {
    const r = await fetch(`/${enc}/`, { credentials: 'omit' });
    if (r.ok) {
      const html = await r.text();
      return parseProfileFromHtml(html, username.toLowerCase());
    }
  } catch {}

  return null;
}

function profileFromApiUser(d) {
  return {
    userId:     d.id,
    username:   d.username,
    isPrivate:  d.is_private ?? false,
    profilePic: d.profile_pic_url_hd ?? d.profile_pic_url ?? null,
    followers:  d.edge_followed_by?.count             ?? d.follower_count  ?? null,
    following:  d.edge_follow?.count                  ?? d.following_count ?? null,
    posts:      d.edge_owner_to_timeline_media?.count ?? d.media_count     ?? null,
  };
}

// Recursively search parsed JSON for an object matching predicate
function deepFind(obj, predicate, depth = 8) {
  if (!obj || typeof obj !== 'object' || depth === 0) return null;
  if (predicate(obj)) return obj;
  for (const v of Object.values(obj)) {
    const found = deepFind(v, predicate, depth - 1);
    if (found) return found;
  }
  return null;
}

function parseProfileFromHtml(html, usernameLower) {
  // Strategy 1: parse <script type="application/json"> Relay store blocks
  const blocks = [...html.matchAll(/<script type="application\/json"[^>]*>([\s\S]*?)<\/script>/g)];
  for (const [, content] of blocks) {
    try {
      const user = deepFind(JSON.parse(content), o =>
        typeof o?.username === 'string' &&
        o.username.toLowerCase() === usernameLower &&
        (o.id || o.pk)
      );
      if (user) {
        return {
          userId:     user.id    ?? user.pk,
          username:   user.username,
          isPrivate:  user.is_private ?? false,
          profilePic: user.profile_pic_url_hd ?? user.profile_pic_url ?? null,
          followers:  user.edge_followed_by?.count             ?? user.follower_count  ?? null,
          following:  user.edge_follow?.count                  ?? user.following_count ?? null,
          posts:      user.edge_owner_to_timeline_media?.count ?? user.media_count     ?? null,
        };
      }
    } catch {}
  }

  // Strategy 2: meta description — Instagram writes "X Followers, Y Following, Z Posts"
  const userId = parseUserIdFromHtml(html, usernameLower);
  const metaDesc = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)?.[1]
                ?? html.match(/<meta[^>]+content="([^"]+)"[^>]+name="description"/i)?.[1]
                ?? '';
  const fwrMatch  = metaDesc.match(/([\d,]+)\s*Followers?/i);
  const fwgMatch  = metaDesc.match(/([\d,]+)\s*Following/i);
  const postMatch = metaDesc.match(/([\d,]+)\s*Posts?/i);
  const fromMeta  = fwrMatch || fwgMatch || postMatch;

  if (userId || fromMeta) {
    const parse = (m) => m ? parseInt(m[1].replace(/,/g, ''), 10) : null;
    const isPrivate  = /is_private["'\s]*:["'\s]*true/i.test(html);
    const picMatch   = html.match(/"profile_pic_url_hd"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const picMatch2  = picMatch ?? html.match(/"profile_pic_url"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    let profilePic   = null;
    if (picMatch2) {
      try { profilePic = JSON.parse('"' + picMatch2[1] + '"'); }
      catch { profilePic = picMatch2[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/'); }
    }
    return {
      userId:    userId ?? null,
      username:  usernameLower,
      isPrivate,
      profilePic,
      followers: parse(fwrMatch)  ?? extractCount(html, 'edge_followed_by')             ?? extractCount(html, 'follower_count'),
      following: parse(fwgMatch)  ?? extractCount(html, 'edge_follow')                  ?? extractCount(html, 'following_count'),
      posts:     parse(postMatch) ?? extractCount(html, 'edge_owner_to_timeline_media')  ?? extractCount(html, 'media_count'),
    };
  }

  return null;
}

function extractCount(html, key) {
  // Handles both {"count":N} and flat "key":N forms
  const m = html.match(new RegExp(`"${key}"\\s*:\\s*(?:\\{[^}]{0,40}"count"\\s*:\\s*(\\d+)|(\\d+))`));
  return m ? parseInt(m[1] ?? m[2], 10) : null;
}

_chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'FETCH_PROFILE') {
    fetchProfile(msg.username)
      .then(profile => sendResponse({ ok: !!profile, profile }))
      .catch(() => sendResponse({ ok: false, profile: null }));
    return true;
  }
  if (msg.type === 'BLOCK_USERNAME') {
    resolveUserId(msg.username)
      .then(id => {
        if (!id) throw new Error('Could not resolve user ID');
        return blockById(id);
      })
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});
