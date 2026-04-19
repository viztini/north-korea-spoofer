(function () {
  const SPOOFED = {
    latitude: 39.0392,
    longitude: 125.7625,
    accuracy: 50,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null
  };

  function makePosition(coords) {
    return {
      coords: {
        ...SPOOFED,
        ...coords,
        toJSON() { return { ...this }; }
      },
      timestamp: Date.now(),
      toJSON() { return { coords: this.coords.toJSON(), timestamp: this.timestamp }; }
    };
  }

  function isEnabled() {
    try {
      return localStorage.getItem('__geospoof_enabled') !== 'false';
    } catch {
      return true;
    }
  }

  const _getCurrentPosition = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
  const _watchPosition = navigator.geolocation.watchPosition.bind(navigator.geolocation);

  navigator.geolocation.getCurrentPosition = function (success, error, options) {
    if (!isEnabled()) return _getCurrentPosition(success, error, options);
    success(makePosition());
  };

  navigator.geolocation.watchPosition = function (success, error, options) {
    if (!isEnabled()) return _watchPosition(success, error, options);
    success(makePosition());
    return Math.floor(Math.random() * 9999);
  };
})();
