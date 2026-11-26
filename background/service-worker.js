importScripts("../shared/storage.js", "../shared/messages.js");

async function deactivateTab(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      action: AreaGridMessages.ACTIONS.DEACTIVATE_TAB_OVERLAY
    });
  } catch {
    // The tab may be closed, restricted, or have no content script.
  }
}

chrome.tabs.onActivated.addListener(({ windowId }) => {
  chrome.tabs.query({ windowId }).then((tabs) => {
    return Promise.all(tabs.map((tab) => deactivateTab(tab.id)));
  }).catch((error) => {
    console.error("Could not deactivate grids after tab activation.", error);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") deactivateTab(tabId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.action !== "string") return false;

  if (message.action === "GET_ACTIVE_TAB_INFO") {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      sendResponse({
        tabId: tab ? tab.id : null,
        url: tab ? tab.url : null,
        origin: tab ? AreaGridStorage.originFromUrl(tab.url) : null
      });
    });
    return true;
  }

  return false;
});
