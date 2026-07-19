// Default category colors — the dataviz reference palette's dark-mode
// categorical slots, validated against this app's surface (#1a2030) with
// scripts/validate_palette.js: lightness band, chroma floor, ≥3:1 contrast all
// PASS; adjacent-pair CVD sits in the floor band, mitigated app-wide by direct
// labels (legend names, budget-bar titles) so identity never rests on color.
// The order is the CVD-safety mechanism — keep it.
export const PRESET_COLORS = [
  '#3987e5', // blue
  '#199e70', // aqua
  '#c98500', // yellow
  '#008300', // green
  '#9085e9', // violet
  '#e66767', // red
  '#d55181', // magenta
  '#d95926', // orange
] as const;
