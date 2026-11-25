import Poco from "commodetto/Poco";
import parseBMF from "commodetto/parseBMF";
import parseRLE from "commodetto/parseRLE";
import Message from "pebble/message";
import Health from "pebble/health";
import Battery from "embedded:sensor/Battery";
import METRICS from "metrics";

// Layout (emery 200x228) on a 16px margin / 8px gap grid. Y values are the top row of ink.
const M = 16;                          // side, top and bottom margin
const GAP = 8;
const Y_DAY = M;                       // 10px tall
const Y_DATE = Y_DAY + 10 + GAP;       // 12px tall
const Y_SPLIT = Y_DAY + 10 + GAP / 2;  // line between weekday and date; weather centres on it
const Y_TIME = 88;                     // 52px tall, centred on the screen
const DOT_D = 12;                      // colon dot diameter (anti-aliased)
const DOT_TOP = 15;                    // first dot below Y_TIME; the second ends on the baseline
const DOT_STEP = 25;
const TIME_PAD = 2;                    // keep this much clear at the screen edges
const Y_RULE = 179;
const Y_VALUE = Y_RULE + 1 + M;        // 16px tall; dot and label centre on it

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const LABELS = [null, "BATTERY", "STEPS", "HEART", "CALORIES"];

const render = new Poco(screen);
const W = render.width;

// inkTop: rows from the line top to the top of the cap-height ink (icon grid for icons).
function font(name, size, inkTop) {
  const f = parseBMF(new Resource(`${name}-${size}.fnt`));
  f.bitmap = parseRLE(new Resource(`${name}-${size}-alpha.bm4`));
  f.inkTop = inkTop;
  return f;
}
const F = {
  time: font("SpaceGrotesk-SemiBold", 72, 19),
  num: font("SpaceGrotesk-SemiBold", 22, 6),
  icons: font("PhosphorWeather", 24, 0),  // Phosphor fill icons on a 24px grid (MIT)
  // Pixel fonts; the bold pair is used on the light theme, where 1px dark strokes look faint.
  small: [font("Pix-mono10", 14, 4), font("Pix-mono10-bold", 14, 4)],
  date: [font("Pix-mono12", 18, 6), font("Pix-mono12-bold", 18, 6)],
};

const gray = (v) => render.makeColor(v, v, v);
const BLACK = gray(0), WHITE = gray(255), DARK = gray(85), LIGHT = gray(170);

const DEFAULTS = {
  temp: null, icon: "", tzOffset: 0, tzLabel: "DUBLIN", complication: 0, light: false,
  accent: 0x35 /* SunsetOrange, Pebble rrggbb */, fahrenheit: false,
};
let s = { ...DEFAULTS };
try {
  s = { ...DEFAULTS, ...JSON.parse(localStorage.getItem("settings")) };
} catch {}

const battery = new Battery({ onSample: () => draw() });
let lastDate = new Date();

const pad = (n) => String(n).padStart(2, "0");

function text(str, f, x, y, color) {
  render.drawText(str, f, color, x, y - f.inkTop);
}

// Ink width of str and the gap between the pen origin and its first visible column.
function ink(m, str) {
  let x = 0, lo = -1, hi = 0;
  for (const c of str) {
    const g = m[c];
    if (!g) continue;
    if (g[1]) {
      if (lo < 0) lo = x + g[0];
      hi = x + g[0] + g[1];
    }
    x += g[2];
  }
  lo = Math.max(lo, 0);
  return { w: hi - lo, lsb: lo };
}

// Draws str with its ink starting at column x, or ending at column x if right. Returns the ink's
// left column.
function inkText(str, f, m, x, y, right, color) {
  const { w, lsb } = ink(m, str);
  if (right) x -= w - 1;
  text(str, f, x - lsb, y, color);
  return x;
}

function thousands(v) {
  if (v >= 10000) return `${Math.floor(v / 1000)}.${Math.floor(v / 100) % 10}K`;
  if (v >= 1000) return `${Math.floor(v / 1000)},${String(v % 1000).padStart(3, "0")}`;
  return String(v);
}

function complication(now) {
  switch (s.complication) {
    case 1: return battery.sample().percent + "%";
    case 2: return thousands(Health.metric.get("step count"));
    case 3: return Health.metric.get("heart rate") || "-";
    case 4: return thousands(Health.metric.get("active calories") + Health.metric.get("resting calories"));
    default: {
      const home = new Date(now.getTime() + s.tzOffset * 60000);
      let h = home.getUTCHours();
      if (watch.hour12) h = h % 12 || 12;
      return `${pad(h)}:${pad(home.getUTCMinutes())}`;
    }
  }
}

function draw() {
  const now = lastDate;
  const fg = s.light ? BLACK : WHITE;
  const dim = s.light ? DARK : LIGHT;
  const a = s.accent;
  const accent = render.makeColor((a >> 4 & 3) * 85, (a >> 2 & 3) * 85, (a & 3) * 85);
  const small = F.small[+s.light], date = F.date[+s.light];

  render.begin();
  render.fillRectangle(s.light ? WHITE : BLACK, 0, 0, W, render.height);

  // Day and date (pixel fonts have a 1px left bearing)
  text(DAYS[now.getDay()], small, M - 1, Y_DAY, dim);
  text(`${pad(now.getDate())} ${MONTHS[now.getMonth()]}`, date, M - 1, Y_DATE, fg);

  // Weather: temperature right on the margin, icon GAP to its left.
  const temp = s.temp === null ? "--" : `${s.temp}°${s.fahrenheit ? "F" : "C"}`;
  const x = inkText(temp, F.num, METRICS.num, W - M - 1, Y_SPLIT - 8, true, fg);
  if (s.icon) inkText(s.icon, F.icons, METRICS.icons, x - 1 - GAP, Y_SPLIT - 12, true, fg);

  // Time: centred by its ink, digits GAP px either side of the colon dots (less if needed to keep
  // TIME_PAD at the edges). An odd leftover pixel comes off the minutes gap so both edges match.
  let h = now.getHours();
  if (watch.hour12) h = h % 12 || 12;
  const hs = pad(h), ms = pad(now.getMinutes());
  const hw = ink(METRICS.time, hs).w, mw = ink(METRICS.time, ms).w;
  const gap = Math.min(GAP, Math.floor((W - 2 * TIME_PAD - hw - DOT_D - mw) / 2));
  const gap2 = gap - ((W - hw - DOT_D - mw) & 1);
  const x0 = Math.floor((W - hw - gap - DOT_D - gap2 - mw) / 2), dotX = x0 + hw + gap;
  inkText(hs, F.time, METRICS.time, x0, Y_TIME, false, fg);
  inkText(ms, F.time, METRICS.time, dotX + DOT_D + gap2, Y_TIME, false, fg);
  for (let i = 0; i < 2; i++) {
    // A radius-r circle covers centre - r .. centre + r - 1.
    render.drawCircle(accent, dotX + DOT_D / 2, Y_TIME + DOT_TOP + DOT_D / 2 + i * DOT_STEP, DOT_D / 2,
                      0, 360);
  }

  // Bottom bar: 8px dot, label GAP after it, value right on the margin.
  render.fillRectangle(s.light ? LIGHT : DARK, M, Y_RULE, W - 2 * M, 1);
  render.drawRoundRect(M, Y_VALUE + 4, 8, 8, accent, 3);
  text(LABELS[s.complication] ?? s.tzLabel, small, M + 8 + GAP - 1, Y_VALUE + 3, dim);
  inkText(String(complication(now)), F.num, METRICS.num, W - M - 1, Y_VALUE, true, fg);

  render.end();
}

let writable = false;
const message = new Message({
  keys: ["TEMP", "ICON", "TZ_OFFSET", "TZ_LABEL", "COMPLICATION", "THEME", "ACCENT", "UNIT"],
  onReadable() {
    const msg = this.read();
    const has = (k) => msg.has(k);
    if (has("TEMP")) s.temp = msg.get("TEMP");
    if (has("ICON")) s.icon = String.fromCharCode(msg.get("ICON"));
    if (has("TZ_OFFSET")) s.tzOffset = msg.get("TZ_OFFSET");
    if (has("TZ_LABEL")) s.tzLabel = String(msg.get("TZ_LABEL")).toUpperCase();
    if (has("COMPLICATION")) s.complication = msg.get("COMPLICATION");
    if (has("THEME")) s.light = !!msg.get("THEME");
    if (has("UNIT")) s.fahrenheit = !!msg.get("UNIT");
    if (has("ACCENT")) s.accent = msg.get("ACCENT") & 0x3f;
    localStorage.setItem("settings", JSON.stringify(s));
    draw();
  },
  onWritable() { writable = true; },
  onSuspend() { writable = false; },
});

watch.addEventListener("minutechange", (e) => {
  lastDate = e.date;
  draw();
  if (writable && e.date.getMinutes() % 30 === 0) {
    message.write(new Map([["ICON", 0]]));  // ask the phone for weather and zone offset
  }
});
watch.addEventListener("health", () => { if (s.complication >= 2) draw(); });
