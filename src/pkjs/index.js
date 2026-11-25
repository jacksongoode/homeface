var Clay = require('pebble-clay');

var ZONES = [
  ['Pacific/Honolulu', 'HONOLULU'], ['America/Anchorage', 'ANCHORAGE'],
  ['America/Los_Angeles', 'LA'], ['America/Denver', 'DENVER'], ['America/Chicago', 'CHICAGO'],
  ['America/New_York', 'NEW YORK'], ['America/Toronto', 'TORONTO'],
  ['America/Mexico_City', 'MEXICO'], ['America/Sao_Paulo', 'SAO PAULO'],
  ['Atlantic/Reykjavik', 'REYKJAVIK'], ['Europe/Dublin', 'DUBLIN'], ['Europe/London', 'LONDON'],
  ['Europe/Lisbon', 'LISBON'], ['Europe/Paris', 'PARIS'], ['Europe/Madrid', 'MADRID'],
  ['Europe/Berlin', 'BERLIN'], ['Europe/Amsterdam', 'AMSTERDAM'], ['Europe/Rome', 'ROME'],
  ['Europe/Stockholm', 'STOCKHOLM'], ['Europe/Athens', 'ATHENS'], ['Europe/Istanbul', 'ISTANBUL'],
  ['Africa/Cairo', 'CAIRO'], ['Africa/Lagos', 'LAGOS'], ['Africa/Johannesburg', 'JO\'BURG'],
  ['Europe/Moscow', 'MOSCOW'], ['Asia/Dubai', 'DUBAI'], ['Asia/Karachi', 'KARACHI'],
  ['Asia/Kolkata', 'INDIA'], ['Asia/Bangkok', 'BANGKOK'], ['Asia/Singapore', 'SINGAPORE'],
  ['Asia/Hong_Kong', 'HONG KONG'], ['Asia/Shanghai', 'SHANGHAI'], ['Asia/Taipei', 'TAIPEI'],
  ['Asia/Seoul', 'SEOUL'], ['Asia/Tokyo', 'TOKYO'], ['Australia/Perth', 'PERTH'],
  ['Australia/Sydney', 'SYDNEY'], ['Pacific/Auckland', 'AUCKLAND']
];

var config = [
  { type: 'heading', defaultValue: 'Homeface' },
  { type: 'section', items: [
    { type: 'select', messageKey: 'ZONE', label: 'Home time zone', defaultValue: 'Europe/Dublin',
      options: ZONES.map(function (z) { return { label: z[0].split('/').pop().replace(/_/g, ' '), value: z[0] }; }) },
    { type: 'input', messageKey: 'TZ_LABEL', label: 'Label (optional)', defaultValue: '',
      attributes: { maxlength: 9, placeholder: 'e.g. HOME' } },
    { type: 'select', messageKey: 'COMPLICATION', label: 'Bottom bar', defaultValue: '0',
      options: [{ label: 'Home time', value: '0' }, { label: 'Battery', value: '1' },
        { label: 'Steps', value: '2' }, { label: 'Heart rate', value: '3' },
        { label: 'Calories', value: '4' }] }
  ] },
  { type: 'section', items: [
    { type: 'radiogroup', messageKey: 'THEME', label: 'Theme', defaultValue: '0',
      options: [{ label: 'Dark', value: '0' }, { label: 'Light', value: '1' }] },
    { type: 'color', messageKey: 'ACCENT', label: 'Accent', defaultValue: 0xFF5555,
      sunlight: false, allowGray: false },
    { type: 'radiogroup', messageKey: 'UNIT', label: 'Temperature', defaultValue: '0',
      options: [{ label: '°C', value: '0' }, { label: '°F', value: '1' }] }
  ] },
  { type: 'submit', defaultValue: 'Save' }
];

var clay = new Clay(config, null, { autoHandleEvents: false });

function settings() {
  try { return JSON.parse(localStorage.getItem('clay-settings')) || {}; } catch (e) { return {}; }
}

// Minutes east of UTC for an IANA zone right now (DST-aware).
function offsetMinutes(zone) {
  var now = new Date(Math.floor(Date.now() / 60000) * 60000);
  var p = {};
  new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric',
    month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
    .formatToParts(now).forEach(function (x) { p[x.type] = +x.value; });
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - now.getTime()) / 60000);
}

function zoneMessage(s) {
  var zone = s.ZONE || 'Europe/Dublin';
  var label = (s.TZ_LABEL || '').trim();
  if (!label) {
    ZONES.forEach(function (z) { if (z[0] === zone) label = z[1]; });
  }
  return { TZ_OFFSET: offsetMinutes(zone), TZ_LABEL: label.toUpperCase().slice(0, 9) };
}

// Same mapping as the original Homezone.
function icon(code) {
  if (code === 0) return 'a';
  if (code <= 3) return 'c';
  if (code <= 48) return 'g';
  if (code <= 67 || (code >= 80 && code <= 82)) return 'd';
  if (code <= 86) return 'e';
  return 'f';
}

function weather() {
  var f = +settings().UNIT === 1;
  navigator.geolocation.getCurrentPosition(function (pos) {
    var x = new XMLHttpRequest();
    x.onload = function () {
      var c = JSON.parse(x.responseText).current;
      Pebble.sendAppMessage({ TEMP: Math.round(c.temperature_2m), UNIT: f ? 1 : 0,
        ICON: icon(c.weather_code).charCodeAt(0) });
    };
    x.open('GET', 'https://api.open-meteo.com/v1/forecast?latitude=' + pos.coords.latitude +
      '&longitude=' + pos.coords.longitude + '&current=temperature_2m,weather_code' +
      '&temperature_unit=' + (f ? 'fahrenheit' : 'celsius'));
    x.send();
  }, function () {}, { timeout: 15000, maximumAge: 15 * 60000 });
}

function refresh() {
  Pebble.sendAppMessage(zoneMessage(settings()), weather, weather);
}

Pebble.addEventListener('ready', refresh);
Pebble.addEventListener('appmessage', refresh);  // the watch asks every 30 minutes

Pebble.addEventListener('showConfiguration', function () {
  Pebble.openURL(clay.generateUrl());
});

Pebble.addEventListener('webviewclosed', function (e) {
  if (!e || !e.response) return;
  var s = clay.getSettings(e.response, false);
  var v = function (k) { return s[k] && s[k].value !== undefined ? s[k].value : s[k]; };
  var rgb = parseInt(v('ACCENT'), 10);
  var msg = zoneMessage({ ZONE: v('ZONE'), TZ_LABEL: v('TZ_LABEL') });
  msg.COMPLICATION = +v('COMPLICATION');
  msg.THEME = +v('THEME');
  msg.ACCENT = (Math.round((rgb >> 16 & 255) / 85) << 4) | (Math.round((rgb >> 8 & 255) / 85) << 2) |
    Math.round((rgb & 255) / 85);
  msg.UNIT = +v('UNIT');
  Pebble.sendAppMessage(msg, weather, weather);
});
