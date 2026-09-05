chrome.runtime.onInstalled.addListener(() => {
  console.log('TransparentVideo Studio (BrowserOS) instalado con éxito.');
  
  chrome.contextMenus.create({
    id: 'open-transparent-studio',
    title: 'Abrir TransparentVideo Studio en pantalla completa',
    contexts: ['action'],
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === 'open-transparent-studio') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('studio/index.html'),
    });
  }
});

// Configure Side Panel behavior on icon click
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('Error al configurar SidePanel behavior:', error));

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'open_studio_tab') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('studio/index.html'),
    });
    sendResponse({ status: 'ok' });
  }
  return true;
});
