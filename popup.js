/* global browser */
const _chrome = typeof browser !== 'undefined' ? browser : chrome; // Firefox / Chrome compat

const input      = document.getElementById('username');
const blockBtn   = document.getElementById('blockBtn');
const infoBtn    = document.getElementById('infoBtn');
const infoBox    = document.getElementById('infoBox');
const avatar     = document.getElementById('avatar');
const noPhoto    = document.getElementById('noPhoto');
const iUsername  = document.getElementById('iUsername');
const iFullName  = document.getElementById('iFullName');
const iId        = document.getElementById('iId');
const iFollowers = document.getElementById('iFollowers');
const iFollowing = document.getElementById('iFollowing');
const iPosts     = document.getElementById('iPosts');
const iBio       = document.getElementById('iBio');
const rowBio     = document.getElementById('rowBio');
const iUrl       = document.getElementById('iUrl');
const rowUrl     = document.getElementById('rowUrl');
const status     = document.getElementById('status');

function setStatus(msg, cls) {
  status.textContent = msg;
  status.className = cls ?? '';
}

function fmt(n, isPrivate) {
  if (isPrivate && n == null) return 'Private';
  if (n == null) return '—';
  return n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + 'M'
       : n >= 1_000     ? (n / 1_000).toFixed(1) + 'K'
       : String(n);
}

function sendMsg(type, payload) {
  return new Promise(resolve =>
    _chrome.runtime.sendMessage({ type, ...payload }, resp =>
      resolve(_chrome.runtime.lastError ? null : resp)
    )
  );
}

// Show "Opening Instagram tab…" if response takes > 900ms (new tab being created)
function withTabFeedback(promise, label) {
  const timer = setTimeout(() => setStatus(`Opening Instagram tab for ${label}…`), 900);
  return promise.finally(() => clearTimeout(timer));
}

// Auto-fill username from active tab URL
_chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const url = tabs[0]?.url ?? '';
  const m = url.match(/instagram\.com\/([a-zA-Z0-9._]+)\/?(?:\?|$)/);
  const reserved = new Set(['explore', 'reels', 'stories', 'direct', 'accounts', 'p', 'tv']);
  if (m && !reserved.has(m[1])) input.value = m[1];
});

infoBtn.addEventListener('click', async () => {
  const username = input.value.trim().replace(/^@/, '');
  if (!username) { setStatus('Enter a username first', 'err'); return; }

  infoBtn.disabled = true;
  setStatus('Fetching…');
  infoBox.classList.remove('visible');

  const resp = await withTabFeedback(sendMsg('POPUP_FETCH_PROFILE', { username }), 'profile lookup');
  infoBtn.disabled = false;

  if (!resp || !resp.ok) {
    setStatus('Could not fetch profile — try reloading the Instagram tab', 'err');
    return;
  }

  const p = resp.profile;
  const priv = p.isPrivate;

  if (p.profilePic) {
    avatar.onerror = () => {
      avatar.style.display = 'none';
      noPhoto.style.display = 'block';
    };
    avatar.src = p.profilePic;
    avatar.style.display = 'block';
    noPhoto.style.display = 'none';
  } else {
    avatar.style.display = 'none';
    noPhoto.style.display = 'block';
  }

  const usernameLabel = '@' + p.username + (priv ? ' 🔒' : '') + (p.isVerified ? ' ✓' : '');
  iUsername.textContent = usernameLabel;
  iUsername.title = usernameLabel;
  iFullName.textContent  = p.fullName || '—';
  iId.textContent        = p.userId ?? '—';
  iFollowers.textContent = fmt(p.followers, priv);
  iFollowing.textContent = fmt(p.following, priv);
  iPosts.textContent     = fmt(p.posts,     priv);

  if (p.bio) {
    iBio.textContent = p.bio;
    rowBio.style.display = '';
  } else {
    rowBio.style.display = 'none';
  }

  if (p.externalUrl) {
    iUrl.textContent = p.externalUrl;
    iUrl.href = p.externalUrl;
    rowUrl.style.display = '';
  } else {
    rowUrl.style.display = 'none';
  }
  infoBox.classList.add('visible');
  setStatus('');
});

blockBtn.addEventListener('click', async () => {
  const username = input.value.trim().replace(/^@/, '');
  if (!username) return;

  blockBtn.disabled = true;
  setStatus('Blocking…');

  const resp = await withTabFeedback(sendMsg('POPUP_BLOCK_USERNAME', { username }), 'blocking');
  blockBtn.disabled = false;

  if (!resp) { setStatus('Error: no Instagram tab found', 'err'); return; }
  if (resp.ok) {
    setStatus(`✓ @${username} blocked`, 'ok');
    input.value = '';
    infoBox.classList.remove('visible');
  } else {
    setStatus(`✗ ${resp.error}`, 'err');
  }
});

input.addEventListener('keydown', (e) => { if (e.key === 'Enter') blockBtn.click(); });
input.addEventListener('input', () => infoBox.classList.remove('visible'));
