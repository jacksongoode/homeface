#include <pebble.h>

// Layout (emery 200x228) on a 16px margin / 8px gap grid. Y values are the top row of ink.
#define M 16                          // side, top and bottom margin
#define GAP 8
#define Y_DAY M                       // 10px tall
#define Y_DATE (Y_DAY + 10 + GAP)     // 12px tall
#define Y_SPLIT (Y_DAY + 10 + GAP / 2) // line between weekday and date; weather centres on it
#define Y_TIME 88                     // 52px tall, centred on the screen
#define DOT_D 13
#define DOT_GAP 12                    // between the two colon dots
#define TIME_PAD 2                    // keep this much clear at the screen edges
#define Y_RULE 179
#define Y_VALUE (Y_RULE + 1 + M)      // 16px tall; dot and label centre on it
#define MIN(a, b) ((a) < (b) ? (a) : (b))
#define MAX(a, b) ((a) > (b) ? (a) : (b))

typedef struct {
  const char *chars;
  int8_t g[][3];
} FontMetrics;
#include "metrics.auto.h"

enum { F_TIME, F_NUM, F_SMALL, F_DATE, F_ICONS, F_COUNT };
// Rows between a text box's top and the top of its ink (cap height; icon grid for F_ICONS).
static const int8_t s_ink_top[F_COUNT] = {21, 6, 4, 6, 0};
static const uint32_t s_font_res[F_COUNT] = {
  RESOURCE_ID_FONT_TIME_72, RESOURCE_ID_FONT_NUM_22, RESOURCE_ID_FONT_SMALL_14,
  RESOURCE_ID_FONT_DATE_18, RESOURCE_ID_FONT_ICONS_25,
};
static GFont s_fonts[F_COUNT];

// Ink width of s; *lsb is the gap between the pen origin and the first inked column.
static int ink_width(const FontMetrics *m, const char *s, int *lsb) {
  int x = 0, lo = -1, hi = 0;
  for (; *s; s++) {
    const char *p = strchr(m->chars, *s);
    if (!p) continue;  // e.g. the lead byte of a UTF-8 sequence
    const int8_t *g = m->g[p - m->chars];
    if (g[1]) {
      if (lo < 0) lo = x + g[0];
      hi = x + g[0] + g[1];
    }
    x += g[2];
  }
  *lsb = MAX(lo, 0);
  return hi - *lsb;
}

enum { C_ZONE, C_BATTERY, C_STEPS, C_HEART, C_CALORIES };

typedef struct {
  int16_t temp;           // INT16_MIN = unknown
  char icon;              // glyph in the icon font, 0 = none
  int16_t tz_offset_min;  // home zone offset from UTC
  char tz_label[8];
  uint8_t complication;
  bool light;
  uint8_t accent;         // GColor argb
  bool fahrenheit;
} Settings;

#define PERSIST_SETTINGS 1

static Window *s_window;
static Layer *s_canvas;
static Settings s = {
  .temp = INT16_MIN, .tz_label = "DUBLIN", .accent = 0xF5 /* GColorSunsetOrange */,
};

static void text(GContext *ctx, const char *str, int f, GRect r, GTextAlignment al, GColor c) {
  r.origin.y -= s_ink_top[f];
  graphics_context_set_text_color(ctx, c);
  graphics_draw_text(ctx, str, s_fonts[f], r, GTextOverflowModeFill, al, NULL);
}

// Draws s with its ink starting at column x, or ending at column x if right. Returns the ink's
// left column.
static int ink_text(GContext *ctx, const char *s, int f, const FontMetrics *m, int x, int y,
                    bool right, GColor c) {
  int lsb, w = ink_width(m, s, &lsb);
  if (right) x -= w - 1;
  text(ctx, s, f, GRect(x - lsb, y, 200, 80), GTextAlignmentLeft, c);
  return x;
}

static void upcase(char *p) {
  for (; *p; p++) {
    if (*p >= 'a' && *p <= 'z') *p -= 'a' - 'A';
  }
}

static void thousands(char *buf, size_t n, int v) {
  if (v >= 10000) {
    snprintf(buf, n, "%d.%dK", v / 1000, v / 100 % 10);
  } else if (v >= 1000) {
    snprintf(buf, n, "%d,%03d", v / 1000, v % 1000);
  } else {
    snprintf(buf, n, "%d", v);
  }
}

static void complication(char *label, char *value, size_t n, time_t now) {
  int v;
  switch (s.complication) {
    case C_BATTERY:
      strncpy(label, "BATTERY", n);
      snprintf(value, n, "%d%%", battery_state_service_peek().charge_percent);
      return;
    case C_STEPS:
      strncpy(label, "STEPS", n);
      thousands(value, n, (int)health_service_sum_today(HealthMetricStepCount));
      return;
    case C_HEART:
      strncpy(label, "HEART", n);
      v = (int)health_service_peek_current_value(HealthMetricHeartRateBPM);
      if (v > 0) snprintf(value, n, "%d", v); else strncpy(value, "-", n);
      return;
    case C_CALORIES:
      strncpy(label, "CALORIES", n);
      thousands(value, n, (int)(health_service_sum_today(HealthMetricActiveKCalories) +
                                health_service_sum_today(HealthMetricRestingKCalories)));
      return;
    default: {
      strncpy(label, s.tz_label, n);
      time_t home = now + s.tz_offset_min * 60;
      strftime(value, n, clock_is_24h_style() ? "%H:%M" : "%I:%M", gmtime(&home));
    }
  }
}

static void update(Layer *layer, GContext *ctx) {
  GRect b = layer_get_bounds(layer);
  const int W = b.size.w;
  const GColor fg = s.light ? GColorBlack : GColorWhite;
  const GColor bg = s.light ? GColorWhite : GColorBlack;
  const GColor dim = s.light ? GColorDarkGray : GColorLightGray;
  const GColor rule = s.light ? GColorLightGray : GColorDarkGray;
  const GColor accent = (GColor){.argb = s.accent};
  time_t now = time(NULL);
  struct tm *t = localtime(&now);
#ifdef DEMO
  t->tm_hour = 0, t->tm_min = 29, t->tm_wday = 3, t->tm_mday = 25, t->tm_mon = 10;
  s.temp = 14, s.icon = 'c', s.tz_offset_min = 8 * 60 + 29 - now % 86400 / 60;
#endif
  char buf[16], buf2[16];

  graphics_context_set_fill_color(ctx, bg);
  graphics_fill_rect(ctx, b, 0, GCornerNone);

  // Day and date
  strftime(buf, sizeof buf, "%a", t);
  upcase(buf);
  text(ctx, buf, F_SMALL, GRect(M - 1, Y_DAY, 80, 20), GTextAlignmentLeft, dim);
  strftime(buf, sizeof buf, "%d %b", t);
  upcase(buf);
  text(ctx, buf, F_DATE, GRect(M - 1, Y_DATE, 90, 24), GTextAlignmentLeft, fg);

  // Weather: temperature right on the margin, icon GAP to its left.
  if (s.temp != INT16_MIN) {
    snprintf(buf, sizeof buf, "%d\xC2\xB0%c", s.temp, s.fahrenheit ? 'F' : 'C');
  } else {
    strncpy(buf, "--", sizeof buf);
  }
  int x = ink_text(ctx, buf, F_NUM, &s_m_num, W - M - 1, Y_SPLIT - 8, true, fg);
  if (s.icon) {
    buf[0] = s.icon;
    buf[1] = '\0';
    ink_text(ctx, buf, F_ICONS, &s_m_icons, x - 1 - GAP, Y_SPLIT - 13, true, fg);
  }

  // Time: centred by its ink, digits GAP px either side of the colon dots (less if needed to keep
  // TIME_PAD at the edges). An odd leftover pixel comes off the minutes gap so both edges match.
  strftime(buf, sizeof buf, clock_is_24h_style() ? "%H" : "%I", t);
  strftime(buf2, sizeof buf2, "%M", t);
  int lsb;
  const int hw = ink_width(&s_m_time, buf, &lsb), mw = ink_width(&s_m_time, buf2, &lsb);
  const int gap = MIN(GAP, (W - 2 * TIME_PAD - hw - DOT_D - mw) / 2);
  const int gap2 = gap - (W - hw - DOT_D - mw) % 2;
  const int x0 = (W - hw - gap - DOT_D - gap2 - mw) / 2, dot_x = x0 + hw + gap;
  ink_text(ctx, buf, F_TIME, &s_m_time, x0, Y_TIME, false, fg);
  ink_text(ctx, buf2, F_TIME, &s_m_time, dot_x + DOT_D + gap2, Y_TIME, false, fg);
  graphics_context_set_fill_color(ctx, accent);
  for (int i = 0; i < 2; i++) {
    graphics_fill_circle(ctx, GPoint(dot_x + DOT_D / 2, Y_TIME + 14 + DOT_D / 2 + i * (DOT_D + DOT_GAP)),
                         DOT_D / 2);
  }

  // Bottom bar: 8px dot, label GAP after it, value right on the margin.
  graphics_context_set_fill_color(ctx, rule);
  graphics_fill_rect(ctx, GRect(M, Y_RULE, W - 2 * M, 1), 0, GCornerNone);
  complication(buf, buf2, sizeof buf, now);
  graphics_context_set_fill_color(ctx, accent);
  graphics_fill_rect(ctx, GRect(M, Y_VALUE + 4, 8, 8), 3, GCornersAll);
  text(ctx, buf, F_SMALL, GRect(M + 8 + GAP - 1, Y_VALUE + 3, 120, 20), GTextAlignmentLeft, dim);
  ink_text(ctx, buf2, F_NUM, &s_m_num, W - M - 1, Y_VALUE, true, fg);
}

static void tick(struct tm *tm, TimeUnits u) {
  layer_mark_dirty(s_canvas);
  DictionaryIterator *it;
  if (tm->tm_min % 30 == 0 && app_message_outbox_begin(&it) == APP_MSG_OK) {
    dict_write_uint8(it, MESSAGE_KEY_ICON, 0);  // ask the phone for weather and zone offset
    app_message_outbox_send();
  }
}
static void battery(BatteryChargeState c) { layer_mark_dirty(s_canvas); }

static void inbox(DictionaryIterator *it, void *ctx) {
  Tuple *t;
  if ((t = dict_find(it, MESSAGE_KEY_TEMP))) s.temp = t->value->int32;
  if ((t = dict_find(it, MESSAGE_KEY_ICON))) s.icon = t->value->int32;
  if ((t = dict_find(it, MESSAGE_KEY_TZ_OFFSET))) s.tz_offset_min = t->value->int32;
  if ((t = dict_find(it, MESSAGE_KEY_TZ_LABEL))) {
    strncpy(s.tz_label, t->value->cstring, sizeof s.tz_label - 1);
    upcase(s.tz_label);
  }
  if ((t = dict_find(it, MESSAGE_KEY_COMPLICATION))) s.complication = t->value->int32;
  if ((t = dict_find(it, MESSAGE_KEY_THEME))) s.light = t->value->int32;
  if ((t = dict_find(it, MESSAGE_KEY_UNIT))) s.fahrenheit = t->value->int32;
  if ((t = dict_find(it, MESSAGE_KEY_ACCENT))) s.accent = 0xC0 | (t->value->int32 & 0x3F);
  persist_write_data(PERSIST_SETTINGS, &s, sizeof s);
  layer_mark_dirty(s_canvas);
}

static void window_load(Window *w) {
  Layer *root = window_get_root_layer(w);
  s_canvas = layer_create(layer_get_bounds(root));
  layer_set_update_proc(s_canvas, update);
  layer_add_child(root, s_canvas);
}

static void window_unload(Window *w) { layer_destroy(s_canvas); }

int main(void) {
  if (persist_get_size(PERSIST_SETTINGS) == sizeof s) {
    persist_read_data(PERSIST_SETTINGS, &s, sizeof s);
  }
  for (int i = 0; i < F_COUNT; i++) {
    s_fonts[i] = fonts_load_custom_font(resource_get_handle(s_font_res[i]));
  }
  s_window = window_create();
  window_set_window_handlers(s_window, (WindowHandlers){.load = window_load,
                                                         .unload = window_unload});
  window_stack_push(s_window, true);
  tick_timer_service_subscribe(MINUTE_UNIT, tick);
  battery_state_service_subscribe(battery);
  app_message_register_inbox_received(inbox);
  app_message_open(256, 64);
  app_event_loop();
  tick_timer_service_unsubscribe();
  battery_state_service_unsubscribe();
  window_destroy(s_window);
  for (int i = 0; i < F_COUNT; i++) fonts_unload_custom_font(s_fonts[i]);
}
