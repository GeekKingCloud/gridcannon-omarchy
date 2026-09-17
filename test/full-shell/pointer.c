// Test-only persistent compositor input device. Protocol bindings are generated
// from the caller's wlr-protocols XML; no generated/vendor code ships here.
#include <wayland-client.h>
#include <stdio.h>
#include <string.h>
#include <stdint.h>
#include <time.h>
#include "pointer.h"

static struct zwlr_virtual_pointer_manager_v1 *manager;
static struct wl_seat *seat;

static void added(void *data, struct wl_registry *registry, uint32_t name,
                  const char *interface, uint32_t version) {
  (void)data;
  (void)version;
  if (!strcmp(interface, "zwlr_virtual_pointer_manager_v1"))
    manager = wl_registry_bind(registry, name, &zwlr_virtual_pointer_manager_v1_interface, 1);
  if (!strcmp(interface, "wl_seat") && !seat)
    seat = wl_registry_bind(registry, name, &wl_seat_interface, 1);
}

static void removed(void *data, struct wl_registry *registry, uint32_t name) {
  (void)data;
  (void)registry;
  (void)name;
}

int main(void) {
  struct wl_display *display = wl_display_connect(NULL);
  if (!display) return 2;
  struct wl_registry *registry = wl_display_get_registry(display);
  const struct wl_registry_listener listener = {added, removed};
  wl_registry_add_listener(registry, &listener, NULL);
  if (wl_display_roundtrip(display) < 0 || !manager || !seat) return 3;
  struct zwlr_virtual_pointer_v1 *pointer =
    zwlr_virtual_pointer_manager_v1_create_virtual_pointer(manager, seat);
  if (wl_display_roundtrip(display) < 0) return 4;
  puts("ready");
  fflush(stdout);

  unsigned x, y, button;
  while (scanf("%u %u %u", &x, &y, &button) == 3) {
    struct timespec now;
    clock_gettime(CLOCK_MONOTONIC, &now);
    uint32_t ms = now.tv_sec * 1000 + now.tv_nsec / 1000000;
    zwlr_virtual_pointer_v1_motion_absolute(pointer, ms, x, y, 1200, 900);
    zwlr_virtual_pointer_v1_frame(pointer);
    if (wl_display_roundtrip(display) < 0) return 4;
    if (button < 2) {
      zwlr_virtual_pointer_v1_button(pointer, ms, 272, button); // BTN_LEFT
      zwlr_virtual_pointer_v1_frame(pointer);
      if (wl_display_roundtrip(display) < 0) return 4;
    }
    puts("ok");
    fflush(stdout);
  }
  zwlr_virtual_pointer_v1_destroy(pointer);
  wl_display_roundtrip(display);
  wl_display_disconnect(display);
  return 0;
}
