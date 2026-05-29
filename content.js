// Runs on instagram.com — handles block requests from the popup only.

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

  const json = await resp.json();
  if (json.status !== 'ok') throw new Error(JSON.stringify(json));
  return json;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'BLOCK_USERNAME') {
    resolveUserId(msg.username)
      .then(id => {
        if (!id) throw new Error('Could not resolve user ID — try "Block by User ID" in the popup');
        return blockById(id);
      })
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  if (msg.type === 'BLOCK_ID') {
    blockById(msg.userId)
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});
