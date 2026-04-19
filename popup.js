const toggle = document.getElementById('toggle');
const status = document.getElementById('status');

chrome.storage.local.get('enabled', (data) => {
  const enabled = data.enabled !== false;
  toggle.checked = enabled;
});

toggle.addEventListener('change', () => {
  const enabled = toggle.checked;
  chrome.storage.local.set({ enabled });

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: (val) => {
          localStorage.setItem('__geospoof_enabled', val ? 'true' : 'false');
        },
        args: [enabled]
      });
    }
  });

  status.innerHTML = enabled
    ? 'Active on all tabs — <span>reload to apply</span>'
    : 'Disabled — <span>reload to restore</span>';
});
