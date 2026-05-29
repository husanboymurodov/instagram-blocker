const input  = document.getElementById('username');
const btn    = document.getElementById('blockBtn');
const status = document.getElementById('status');

function setStatus(msg, cls) {
  status.textContent = msg;
  status.className = cls ?? '';
}

// Auto-fill from active tab URL when on a profile page
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const url = tabs[0]?.url ?? '';
  const m = url.match(/instagram\.com\/([a-zA-Z0-9._]+)\/?(?:\?|$)/);
  const reserved = new Set(['explore', 'reels', 'stories', 'direct', 'accounts', 'p', 'tv']);
  if (m && !reserved.has(m[1])) input.value = m[1];
});

btn.addEventListener('click', () => {
  const username = input.value.trim().replace(/^@/, '');
  if (!username) return;

  btn.disabled = true;
  setStatus('Resolving…');

  chrome.runtime.sendMessage({ type: 'POPUP_BLOCK_USERNAME', username }, (resp) => {
    btn.disabled = false;
    if (chrome.runtime.lastError || !resp) {
      setStatus('Error: no Instagram tab found', 'err');
      return;
    }
    if (resp.ok) {
      setStatus(`✓ @${username} blocked`, 'ok');
      input.value = '';
    } else {
      setStatus(`✗ ${resp.error}`, 'err');
    }
  });
});

input.addEventListener('keydown', (e) => { if (e.key === 'Enter') btn.click(); });
