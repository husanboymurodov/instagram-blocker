// Runs on every instagram.com page. Injects block button on profile pages.

const DOC_ID = '27585081607756220'; // usePolarisBlockManyMutation — may need refresh if Instagram redeploys

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
  // Method 1: profile info API (fails if target blocked you)
  try {
    const resp = await fetch(`/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`, {
      headers: { 'x-ig-app-id': '936619743392459' }
    });
    const data = await resp.json();
    const id = data?.data?.user?.id;
    if (id) return id;
  } catch {}

  // Method 2: search API (works even when blocked by target)
  try {
    const resp = await fetch(`/web/search/topsearch/?query=${encodeURIComponent(username)}&context=blended&count=10`);
    const data = await resp.json();
    const user = data.users?.find(u => u.user.username.toLowerCase() === username.toLowerCase());
    if (user?.user?.pk) return user.user.pk;
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

// ── ID fallback UI (when blocked by target) ───────────────────────────────────

function showIdInput(btn, username) {
  btn.remove();

  const wrap = document.createElement('div');
  wrap.id = 'ig-blocker-btn';
  Object.assign(wrap.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: '9999',
    background: '#1a1a1a',
    border: '1px solid #444',
    borderRadius: '10px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
    width: '220px',
  });

  const label = document.createElement('p');
  label.textContent = `Can't resolve @${username} — paste their User ID:`;
  Object.assign(label.style, { color: '#aaa', fontSize: '11px', margin: '0' });

  const link = document.createElement('a');
  link.textContent = 'Get ID from commentpicker.com →';
  link.href = `https://commentpicker.com/instagram-user-id.php`;
  link.target = '_blank';
  Object.assign(link.style, { color: '#ed4956', fontSize: '11px' });

  const input = document.createElement('input');
  input.placeholder = 'e.g. 77539356504';
  Object.assign(input.style, {
    padding: '6px 8px', borderRadius: '6px', border: '1px solid #444',
    background: '#0f0f0f', color: '#fff', fontSize: '12px', outline: 'none',
  });

  const submitBtn = document.createElement('button');
  submitBtn.textContent = 'Block by ID';
  Object.assign(submitBtn.style, {
    padding: '7px', borderRadius: '6px', border: 'none',
    background: '#ed4956', color: '#fff', fontWeight: '600',
    fontSize: '12px', cursor: 'pointer',
  });

  submitBtn.addEventListener('click', async () => {
    const id = input.value.trim();
    if (!id || !/^\d+$/.test(id)) { input.style.borderColor = '#ed4956'; return; }
    submitBtn.textContent = 'Blocking…';
    submitBtn.disabled = true;
    try {
      await blockById(id);
      submitBtn.textContent = '✓ Blocked';
      submitBtn.style.background = '#4CAF50';
    } catch (err) {
      submitBtn.textContent = '✗ Failed';
      submitBtn.style.background = '#888';
      submitBtn.title = err.message;
    }
  });

  wrap.appendChild(label);
  wrap.appendChild(link);
  wrap.appendChild(input);
  wrap.appendChild(submitBtn);
  document.body.appendChild(wrap);
}

// ── Button injection ──────────────────────────────────────────────────────────

function getProfileUsername() {
  // Match /username/ but not /explore/, /reels/, etc.
  const m = location.pathname.match(/^\/([a-zA-Z0-9._]+)\/?$/);
  const reserved = new Set(['explore', 'reels', 'stories', 'direct', 'accounts', 'p', 'tv']);
  return m && !reserved.has(m[1]) ? m[1] : null;
}

function injectButton(username) {
  if (document.getElementById('ig-blocker-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'ig-blocker-btn';
  btn.textContent = 'Block';
  Object.assign(btn.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: '9999',
    padding: '10px 20px',
    background: '#ed4956',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  });

  btn.addEventListener('click', async () => {
    btn.textContent = 'Resolving…';
    btn.disabled = true;
    try {
      const userId = await resolveUserId(username);
      if (!userId) {
        // Both APIs failed — they blocked us. Ask for manual ID.
        showIdInput(btn, username);
        return;
      }
      btn.textContent = 'Blocking…';
      await blockById(userId);
      btn.textContent = '✓ Blocked';
      btn.style.background = '#4CAF50';
    } catch (err) {
      btn.textContent = '✗ Failed';
      btn.style.background = '#888';
      btn.title = err.message;
      console.error('[IG Blocker]', err);
    }
  });

  document.body.appendChild(btn);
}

function removeButton() {
  document.getElementById('ig-blocker-btn')?.remove();
}

// Re-evaluate on SPA navigation
let lastPath = location.pathname;
const observer = new MutationObserver(() => {
  if (location.pathname === lastPath) return;
  lastPath = location.pathname;
  removeButton();
  const username = getProfileUsername();
  if (username) injectButton(username);
});
observer.observe(document.body, { childList: true, subtree: true });

// Initial load
const username = getProfileUsername();
if (username) injectButton(username);

// Listen for block requests from popup
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'BLOCK_USERNAME') {
    resolveUserId(msg.username)
      .then(id => {
        if (!id) throw new Error('Could not resolve user ID — try Block by User ID instead');
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
