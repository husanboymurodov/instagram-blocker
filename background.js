// Routes popup block requests to the active Instagram tab's content script.

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'POPUP_BLOCK_USERNAME') return;

  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const tab = tabs[0];
    const isOnInstagram = tab?.url?.startsWith('https://www.instagram.com');

    if (!isOnInstagram) {
      // Open Instagram, inject after load, then block
      chrome.tabs.create({ url: 'https://www.instagram.com/' }, (newTab) => {
        const listener = (tabId, info) => {
          if (tabId !== newTab.id || info.status !== 'complete') return;
          chrome.tabs.onUpdated.removeListener(listener);
          chrome.tabs.sendMessage(newTab.id, { type: 'BLOCK_USERNAME', username: msg.username }, sendResponse);
        };
        chrome.tabs.onUpdated.addListener(listener);
      });
    } else {
      chrome.tabs.sendMessage(tab.id, { type: 'BLOCK_USERNAME', username: msg.username }, sendResponse);
    }
  });

  return true; // async
});
