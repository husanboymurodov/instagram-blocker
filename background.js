// Routes popup block requests to the active Instagram tab's content script.

function forwardToInstagramTab(msg, sendResponse) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    const isOnInstagram = tab?.url?.startsWith('https://www.instagram.com');

    if (!isOnInstagram) {
      chrome.tabs.create({ url: 'https://www.instagram.com/' }, (newTab) => {
        const listener = (tabId, info) => {
          if (tabId !== newTab.id || info.status !== 'complete') return;
          chrome.tabs.onUpdated.removeListener(listener);
          chrome.tabs.sendMessage(newTab.id, msg, sendResponse);
        };
        chrome.tabs.onUpdated.addListener(listener);
      });
    } else {
      chrome.tabs.sendMessage(tab.id, msg, sendResponse);
    }
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'POPUP_RESOLVE_USERNAME') {
    forwardToInstagramTab({ type: 'RESOLVE_USERNAME', username: msg.username }, sendResponse);
    return true;
  }
  if (msg.type === 'POPUP_BLOCK_USERNAME') {
    forwardToInstagramTab({ type: 'BLOCK_USERNAME', username: msg.username }, sendResponse);
    return true;
  }
  if (msg.type === 'POPUP_BLOCK_ID') {
    forwardToInstagramTab({ type: 'BLOCK_ID', userId: msg.userId }, sendResponse);
    return true;
  }
});
