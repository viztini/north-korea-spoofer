const LOCATIONS = {
  pyongyang:  { latitude: 39.03850,  longitude: 125.75432,  timezone: 'Asia/Pyongyang',   label: 'Pyongyang, DPRK' },
  moscow:     { latitude: 55.75222,  longitude: 37.61556,   timezone: 'Europe/Moscow',    label: 'Moscow, Russia' },
  beijing:    { latitude: 39.90420,  longitude: 116.40739,  timezone: 'Asia/Shanghai',    label: 'Beijing, China' },
  washington: { latitude: 38.89511,  longitude: -77.03637,  timezone: 'America/New_York', label: 'Washington D.C.' },
  london:     { latitude: 51.50735,  longitude: -0.12776,   timezone: 'Europe/London',    label: 'London, UK' },
  tokyo:      { latitude: 35.68950,  longitude: 139.69171,  timezone: 'Asia/Tokyo',       label: 'Tokyo, Japan' },
  sydney:     { latitude: -33.86785, longitude: 151.20732,  timezone: 'Australia/Sydney', label: 'Sydney, Australia' },
  custom:     { latitude: 0,         longitude: 0,          timezone: 'UTC',              label: 'Custom' }
};

const elPreset   = document.getElementById('preset');
const elCustom   = document.getElementById('custom-inputs');
const elLat      = document.getElementById('custom-lat');
const elLng      = document.getElementById('custom-lng');
const elTz       = document.getElementById('custom-tz');
const elCoords   = document.getElementById('coords-display');
const elTzDisp   = document.getElementById('tz-display');
const elEnabled  = document.getElementById('toggle-enabled');
const elSpTz     = document.getElementById('toggle-tz');
const elSpLang   = document.getElementById('toggle-lang');

function fmt(n, decimals) { return parseFloat(n).toFixed(decimals); }

function updateDisplay(preset, customLat, customLng, customTz) {
  if (preset === 'custom') {
    elCoords.textContent = `${fmt(customLat,4)} N, ${fmt(customLng,4)} E`;
    elTzDisp.textContent = customTz || 'UTC';
  } else {
    const loc = LOCATIONS[preset];
    elCoords.textContent = `${fmt(loc.latitude,4)} ${loc.latitude >= 0 ? 'N' : 'S'}, ${fmt(Math.abs(loc.longitude),4)} ${loc.longitude >= 0 ? 'E' : 'W'}`;
    elTzDisp.textContent = loc.timezone;
  }
}

function buildConfig() {
  const preset = elPreset.value;
  return {
    enabled:   elEnabled.checked,
    preset,
    spoof_tz:  elSpTz.checked,
    spoof_lang: elSpLang.checked,
    custom: {
      latitude:  parseFloat(elLat.value) || 0,
      longitude: parseFloat(elLng.value) || 0,
      timezone:  elTz.value || 'UTC',
      label:     'Custom'
    }
  };
}

function saveAndApply() {
  const cfg = buildConfig();
  chrome.storage.local.set({ geospoof_config: cfg });
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: (cfgStr) => { localStorage.setItem('__geospoof_config', cfgStr); },
      args: [JSON.stringify(cfg)]
    });
  });
  updateDisplay(cfg.preset, cfg.custom.latitude, cfg.custom.longitude, cfg.custom.timezone);
}

// Load saved config
chrome.storage.local.get('geospoof_config', (data) => {
  const cfg = data.geospoof_config;
  if (!cfg) { updateDisplay('pyongyang'); return; }

  elPreset.value      = cfg.preset || 'pyongyang';
  elEnabled.checked   = cfg.enabled !== false;
  elSpTz.checked      = cfg.spoof_tz !== false;
  elSpLang.checked    = !!cfg.spoof_lang;

  if (cfg.preset === 'custom' && cfg.custom) {
    elLat.value = cfg.custom.latitude;
    elLng.value = cfg.custom.longitude;
    elTz.value  = cfg.custom.timezone;
    elCustom.classList.add('visible');
  }

  updateDisplay(cfg.preset,
    cfg.custom ? cfg.custom.latitude  : 0,
    cfg.custom ? cfg.custom.longitude : 0,
    cfg.custom ? cfg.custom.timezone  : 'UTC'
  );
});

elPreset.addEventListener('change', () => {
  const isCustom = elPreset.value === 'custom';
  elCustom.classList.toggle('visible', isCustom);
  saveAndApply();
});

[elEnabled, elSpTz, elSpLang].forEach(el => el.addEventListener('change', saveAndApply));
[elLat, elLng, elTz].forEach(el => el.addEventListener('input', saveAndApply));
