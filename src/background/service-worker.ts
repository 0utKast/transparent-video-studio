// Background Service Worker for TransparentVideo Studio (Manifest V3)

chrome.runtime.onInstalled.addListener(async () => {
  console.log('[TransparentVideo Studio] Extensión instalada con éxito.');

  // Safe Context Menu creation
  try {
    if (chrome.contextMenus && 'create' in chrome.contextMenus) {
      chrome.contextMenus.create({
        id: 'open-transparent-studio',
        title: 'Abrir TransparentVideo Studio en pantalla completa',
        contexts: ['action'],
      });
    }
  } catch (err) {
    console.warn('[TransparentVideo Studio] Error al registrar contextMenus:', err);
  }

  // Safe Side Panel behavior configuration
  try {
    if (chrome.sidePanel && 'setPanelBehavior' in chrome.sidePanel) {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    }
  } catch (err) {
    console.warn('[TransparentVideo Studio] Error al configurar sidePanel behavior:', err);
  }
});

// Safe Context Menu click listener
if (chrome.contextMenus && chrome.contextMenus.onClicked) {
  chrome.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === 'open-transparent-studio') {
      chrome.tabs.create({
        url: chrome.runtime.getURL('studio/index.html'),
      });
    }
  });
}

// Message handler for opening the Studio Tab from SidePanel or Popups
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.action === 'open_studio_tab' || message?.action === 'OPEN_STUDIO_TAB') {
    (async () => {
      try {
        const studioUrl = chrome.runtime.getURL('studio/index.html');
        const existingTabs = await chrome.tabs.query({ url: studioUrl });
        if (existingTabs.length > 0 && existingTabs[0].id) {
          await chrome.tabs.update(existingTabs[0].id, { active: true });
          if (existingTabs[0].windowId) {
            await chrome.windows.update(existingTabs[0].windowId, { focused: true });
          }
        } else {
          await chrome.tabs.create({ url: studioUrl });
        }
        sendResponse({ success: true });
      } catch (err: any) {
        sendResponse({ success: false, error: err?.message || String(err) });
      }
    })();
    return true; // Keep channel open for async response
  }
  return false;
});
