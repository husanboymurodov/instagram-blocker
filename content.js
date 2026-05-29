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
  const u = username.toLowerCase();

  try {
    const r = await fetch(`/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`, {
      headers: { 'x-ig-app-id': '936619743392459' },
    });
    const id = (await r.json())?.data?.user?.id;
    if (id) return id;
  } catch {}

  try {
    const r = await fetch(`/web/search/topsearch/?query=${encodeURIComponent(username)}&context=blended&count=10`);
    const match = (await r.json()).users?.find(x => x.user.username.toLowerCase() === u);
    if (match?.user?.pk) return match.user.pk;
  } catch {}

  try {
    const r = await fetch(`/api/v1/users/search/?query=${encodeURIComponent(username)}&count=10`, {
      headers: { 'x-ig-app-id': '936619743392459' },
    });
    const match = (await r.json()).users?.find(x => x.username.toLowerCase() === u);
    if (match?.pk) return match.pk;
  } catch {}

  try {
    const r = await fetch(`/${encodeURIComponent(username)}/?__a=1&__d=dis`);
    const d = await r.json();
    const id = d?.graphql?.user?.id ?? d?.data?.user?.id;
    if (id) return id;
  } catch {}

  return null;
}

async function blockByUserId(userId) {
  const csrftoken = getCookie('csrftoken');
  const dsUserId  = getCookie('ds_user_id');
  const fbDtsg    = extractPageToken('DTSGInitialData') ?? extractPageToken('DTSGInitData');
  const lsd       = extractPageToken('LSD');

  if (!csrftoken || !fbDtsg || !lsd) {
    throw new Error(`Missing session tokens — csrftoken:${!!csrftoken} fb_dtsg:${!!fbDtsg} lsd:${!!lsd}`);
  }

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
    body: new URLSearchParams({
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
      variables: JSON.stringify({ target_user_ids: [String(userId)] }),
      server_timestamps: 'true',
      doc_id: DOC_ID,
    }).toString(),
  });

  const json = await resp.json();
  if (json.status !== 'ok') throw new Error(JSON.stringify(json));
}

async function blockUser(username) {
  const userId = await resolveUserId(username);
  if (!userId) throw new Error(`Could not resolve user ID for @${username}`);
  await blockByUserId(userId);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'BLOCK_USERNAME') return;
  blockUser(msg.username)
    .then(() => sendResponse({ ok: true }))
    .catch(err => sendResponse({ ok: false, error: err.message }));
  return true;
});
