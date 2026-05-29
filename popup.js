const input   = document.getElementById('username');
const btn     = document.getElementById('blockBtn');
const status  = document.getElementById('status');

function setStatus(msg, cls) {
  status.textContent = msg;
  status.className = cls ?? '';
}

btn.addEventListener('click', async () => {
  const raw = input.value.trim().replace(/^@/, '');
  if (!raw) return;

  btn.disabled = true;
  setStatus('Working…');

  chrome.runtime.sendMessage({ type: 'POPUP_BLOCK_USERNAME', username: raw }, (resp) => {
    btn.disabled = false;
    if (chrome.runtime.lastError || !resp) {
      setStatus('Error: no Instagram tab found', 'err');
      return;
    }
    if (resp.ok) {
      setStatus(`✓ @${raw} blocked`, 'ok');
      input.value = '';
    } else {
      setStatus(`✗ ${resp.error}`, 'err');
    }
  });
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btn.click();
});
