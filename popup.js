const input       = document.getElementById('username');
const btn         = document.getElementById('blockBtn');
const status      = document.getElementById('status');
const useridInput = document.getElementById('userid');
const byIdBtn     = document.getElementById('blockByIdBtn');
const statusId    = document.getElementById('statusId');

function setStatus(el, msg, cls) {
  el.textContent = msg;
  el.className = cls ?? '';
}

function sendMsg(type, payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...payload }, (resp) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(resp);
    });
  });
}

// Auto-fill username from active tab URL when on a profile page
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const url = tabs[0]?.url ?? '';
  const m = url.match(/instagram\.com\/([a-zA-Z0-9._]+)\/?(?:\?|$)/);
  const reserved = new Set(['explore', 'reels', 'stories', 'direct', 'accounts', 'p', 'tv']);
  if (m && !reserved.has(m[1])) {
    input.value = m[1];
    triggerResolve(m[1]);
  }
});

// Debounced auto-resolve: username → user ID
let resolveTimer = null;
function triggerResolve(username) {
  clearTimeout(resolveTimer);
  useridInput.value = '';
  setStatus(status, '');
  if (!username) return;
  setStatus(status, 'Resolving ID…');
  resolveTimer = setTimeout(async () => {
    const resp = await sendMsg('POPUP_RESOLVE_USERNAME', { username });
    if (!resp) {
      setStatus(status, 'No Instagram tab open', 'err');
      return;
    }
    if (resp.ok && resp.userId) {
      useridInput.value = resp.userId;
      setStatus(status, `ID: ${resp.userId}`, 'ok');
    } else {
      setStatus(status, 'Could not resolve — enter ID manually', 'err');
    }
  }, 600);
}

input.addEventListener('input', () => {
  const raw = input.value.trim().replace(/^@/, '');
  triggerResolve(raw);
});

btn.addEventListener('click', async () => {
  const raw = input.value.trim().replace(/^@/, '');
  if (!raw) return;
  btn.disabled = true;
  setStatus(status, 'Blocking…');
  const resp = await sendMsg('POPUP_BLOCK_USERNAME', { username: raw });
  btn.disabled = false;
  if (!resp) { setStatus(status, 'Error: no Instagram tab found', 'err'); return; }
  if (resp.ok) { setStatus(status, `✓ @${raw} blocked`, 'ok'); input.value = ''; useridInput.value = ''; }
  else setStatus(status, `✗ ${resp.error}`, 'err');
});

byIdBtn.addEventListener('click', async () => {
  const id = useridInput.value.trim();
  if (!id || !/^\d+$/.test(id)) { setStatus(statusId, '✗ Enter a valid numeric ID', 'err'); return; }
  byIdBtn.disabled = true;
  setStatus(statusId, 'Blocking…');
  const resp = await sendMsg('POPUP_BLOCK_ID', { userId: id });
  byIdBtn.disabled = false;
  if (!resp) { setStatus(statusId, 'Error: no Instagram tab found', 'err'); return; }
  if (resp.ok) { setStatus(statusId, `✓ User ${id} blocked`, 'ok'); useridInput.value = ''; }
  else setStatus(statusId, `✗ ${resp.error}`, 'err');
});

input.addEventListener('keydown', (e) => { if (e.key === 'Enter') btn.click(); });
useridInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') byIdBtn.click(); });
