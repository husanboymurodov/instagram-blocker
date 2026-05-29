chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'POPUP_BLOCK_USERNAME') return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab?.url?.startsWith('https://www.instagram.com')) {
      chrome.tabs.sendMessage(tab.id, { type: 'BLOCK_USERNAME', username: msg.username }, sendResponse);
    } else {
      chrome.tabs.create({ url: 'https://www.instagram.com/' }, (newTab) => {
        const listener = (tabId, info) => {
          if (tabId !== newTab.id || info.status !== 'complete') return;
          chrome.tabs.onUpdated.removeListener(listener);
          chrome.tabs.sendMessage(newTab.id, { type: 'BLOCK_USERNAME', username: msg.username }, sendResponse);
        };
        chrome.tabs.onUpdated.addListener(listener);
      });
    }
  });

  return true;
});
