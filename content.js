(function () {
  const LOCATIONS = {
    pyongyang:   { latitude: 39.03850,  longitude: 125.75432,  timezone: 'Asia/Pyongyang',    label: 'Pyongyang, DPRK' },
    moscow:      { latitude: 55.75222,  longitude: 37.61556,   timezone: 'Europe/Moscow',     label: 'Moscow, Russia' },
    beijing:     { latitude: 39.90420,  longitude: 116.40739,  timezone: 'Asia/Shanghai',     label: 'Beijing, China' },
    washington:  { latitude: 38.89511,  longitude: -77.03637,  timezone: 'America/New_York',  label: 'Washington D.C.' },
    london:      { latitude: 51.50735,  longitude: -0.12776,   timezone: 'Europe/London',     label: 'London, UK' },
    tokyo:       { latitude: 35.68950,  longitude: 139.69171,  timezone: 'Asia/Tokyo',        label: 'Tokyo, Japan' },
    sydney:      { latitude: -33.86785, longitude: 151.20732,  timezone: 'Australia/Sydney',  label: 'Sydney, Australia' },
    custom:      { latitude: 0,         longitude: 0,          timezone: 'UTC',               label: 'Custom' }
  };

  function jitter(val, amount) {
    return val + (Math.random() - 0.5) * amount;
  }

  function getConfig() {
    try {
      const raw = localStorage.getItem('__geospoof_config');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }

  function getLocation(cfg) {
    if (!cfg) return null;
    return cfg.preset === 'custom' ? cfg.custom : LOCATIONS[cfg.preset];
  }

  function makeSpoofedCoords(loc) {
    return {
      latitude:         jitter(loc.latitude, 0.0008),
      longitude:        jitter(loc.longitude, 0.0008),
      accuracy:         Math.round(15 + Math.random() * 40),
      altitude:         null,
      altitudeAccuracy: null,
      heading:          NaN,
      speed:            NaN,
      toJSON() {
        return {
          latitude: this.latitude, longitude: this.longitude,
          accuracy: this.accuracy, altitude: this.altitude,
          altitudeAccuracy: this.altitudeAccuracy, heading: this.heading, speed: this.speed
        };
      }
    };
  }

  function makePosition(loc) {
    return {
      coords: makeSpoofedCoords(loc),
      timestamp: Date.now(),
      toJSON() { return { coords: this.coords.toJSON(), timestamp: this.timestamp }; }
    };
  }

  // --- Geolocation API ---
  const _getCurrentPosition = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
  const _watchPosition      = navigator.geolocation.watchPosition.bind(navigator.geolocation);
  const _clearWatch         = navigator.geolocation.clearWatch.bind(navigator.geolocation);

  navigator.geolocation.getCurrentPosition = function (success, error, options) {
    const cfg = getConfig();
    if (!cfg || !cfg.enabled) return _getCurrentPosition(success, error, options);
    const loc = getLocation(cfg);
    if (!loc) return _getCurrentPosition(success, error, options);
    setTimeout(() => success(makePosition(loc)), 60 + Math.random() * 180);
  };

  navigator.geolocation.watchPosition = function (success, error, options) {
    const cfg = getConfig();
    if (!cfg || !cfg.enabled) return _watchPosition(success, error, options);
    const loc = getLocation(cfg);
    if (!loc) return _watchPosition(success, error, options);
    setTimeout(() => success(makePosition(loc)), 80);
    const id = setInterval(() => success(makePosition(loc)), 4000);
    return id;
  };

  navigator.geolocation.clearWatch = function (id) {
    clearInterval(id);
    try { _clearWatch(id); } catch (_) {}
  };

  // --- Permissions API ---
  const _permissionsQuery = navigator.permissions.query.bind(navigator.permissions);
  navigator.permissions.query = function (descriptor) {
    const cfg = getConfig();
    if (cfg && cfg.enabled && descriptor && descriptor.name === 'geolocation') {
      return Promise.resolve({
        state: 'granted', onchange: null,
        addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true
      });
    }
    return _permissionsQuery(descriptor);
  };

  // --- Intl.DateTimeFormat timezone spoofing ---
  const _NativeDTF = Intl.DateTimeFormat;

  function getSpoofedTZ() {
    const cfg = getConfig();
    if (!cfg || !cfg.enabled || !cfg.spoof_tz) return null;
    const loc = getLocation(cfg);
    return loc ? loc.timezone : null;
  }

  function PatchedDTF(locales, options) {
    const tz = getSpoofedTZ();
    if (tz) options = Object.assign({}, options, { timeZone: tz });
    return new _NativeDTF(locales, options);
  }
  PatchedDTF.prototype = _NativeDTF.prototype;
  PatchedDTF.supportedLocalesOf = _NativeDTF.supportedLocalesOf.bind(_NativeDTF);
  Intl.DateTimeFormat = PatchedDTF;

  const _resolvedOptions = _NativeDTF.prototype.resolvedOptions;
  _NativeDTF.prototype.resolvedOptions = function () {
    const result = _resolvedOptions.call(this);
    const tz = getSpoofedTZ();
    if (tz) result.timeZone = tz;
    return result;
  };

  // --- Date locale methods ---
  ['toLocaleDateString', 'toLocaleTimeString', 'toLocaleString'].forEach(method => {
    const orig = Date.prototype[method];
    Date.prototype[method] = function (locales, options) {
      const tz = getSpoofedTZ();
      if (tz) options = Object.assign({}, options, { timeZone: tz });
      return orig.call(this, locales, options);
    };
  });

  // --- getTimezoneOffset ---
  const _getTimezoneOffset = Date.prototype.getTimezoneOffset;
  Date.prototype.getTimezoneOffset = function () {
    const tz = getSpoofedTZ();
    if (!tz) return _getTimezoneOffset.call(this);
    try {
      const date = this;
      const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
      const tzStr  = date.toLocaleString('en-US', { timeZone: tz });
      const utcMs  = new Date(utcStr).getTime();
      const tzMs   = new Date(tzStr).getTime();
      return (utcMs - tzMs) / 60000;
    } catch {
      return _getTimezoneOffset.call(this);
    }
  };

  // --- navigator.language hint (soft spoof, best effort) ---
  const LANG_MAP = {
    pyongyang: 'ko-KP', moscow: 'ru-RU', beijing: 'zh-CN',
    washington: 'en-US', london: 'en-GB', tokyo: 'ja-JP',
    sydney: 'en-AU', custom: 'en-US'
  };

  try {
    const cfg = getConfig();
    if (cfg && cfg.enabled && cfg.spoof_lang) {
      const lang = LANG_MAP[cfg.preset] || 'en-US';
      Object.defineProperty(navigator, 'language', { get: () => lang, configurable: true });
      Object.defineProperty(navigator, 'languages', { get: () => [lang, lang.split('-')[0]], configurable: true });
    }
  } catch (_) {}

})();
