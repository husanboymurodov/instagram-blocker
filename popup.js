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

// Auto-fill username from active tab URL if on a profile page
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const url = tabs[0]?.url ?? '';
  const m = url.match(/instagram\.com\/([a-zA-Z0-9._]+)\/?(?:\?|$)/);
  const reserved = new Set(['explore', 'reels', 'stories', 'direct', 'accounts', 'p', 'tv']);
  if (m && !reserved.has(m[1])) input.value = m[1];
});

btn.addEventListener('click', () => {
  const raw = input.value.trim().replace(/^@/, '');
  if (!raw) return;
  btn.disabled = true;
  setStatus(status, 'Resolving…');

  chrome.runtime.sendMessage({ type: 'POPUP_BLOCK_USERNAME', username: raw }, (resp) => {
    btn.disabled = false;
    if (chrome.runtime.lastError || !resp) {
      setStatus(status, 'Error: no Instagram tab found', 'err');
      return;
    }
    if (resp.ok) {
      setStatus(status, `✓ @${raw} blocked`, 'ok');
      input.value = '';
    } else {
      setStatus(status, `✗ ${resp.error}`, 'err');
    }
  });
});

byIdBtn.addEventListener('click', () => {
  const id = useridInput.value.trim();
  if (!id || !/^\d+$/.test(id)) {
    setStatus(statusId, '✗ Enter a valid numeric ID', 'err');
    return;
  }
  byIdBtn.disabled = true;
  setStatus(statusId, 'Blocking…');

  chrome.runtime.sendMessage({ type: 'POPUP_BLOCK_ID', userId: id }, (resp) => {
    byIdBtn.disabled = false;
    if (chrome.runtime.lastError || !resp) {
      setStatus(statusId, 'Error: no Instagram tab found', 'err');
      return;
    }
    if (resp.ok) {
      setStatus(statusId, `✓ User ${id} blocked`, 'ok');
      useridInput.value = '';
    } else {
      setStatus(statusId, `✗ ${resp.error}`, 'err');
    }
  });
});

input.addEventListener('keydown', (e) => { if (e.key === 'Enter') btn.click(); });
useridInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') byIdBtn.click(); });
