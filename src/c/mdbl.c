#include <pebble.h>

int main(void) {
  Window *w = window_create();
  window_stack_push(w, true);

  // The default 32 kB pool runs out with the fonts and metrics loaded; see "Memory" in the Alloy
  // reference.
  ModdableCreationRecord cr = {
    .recordSize = sizeof(cr),
    .stack = 5120,
    .slot = 31744,
    .chunk = 19456,
#ifdef PBL_DEBUG
    // Built with `pebble build --debug`: enable the xsbug JavaScript debugger.
    .flags = kModdableCreationFlagDebug,
#endif
  };
  moddable_createMachine(&cr);

  window_destroy(w);
}
