/**
 * Category palette derived from Vanilla #FFEBAF × Moonstone #4C9DB0.
 * Moonstone and a deepened vanilla-gold lead; the rest are mid-lightness
 * companions (teals, sage, terracotta, heather) so every hue reads on both
 * the vanilla paper and the moonstone-ink night without one dominating.
 */
export const CATEGORY_PALETTE = [
  '#4c9db0', // moonstone (brand)
  '#e0a93b', // vanilla gold
  '#d9734e', // terracotta
  '#2f6f7e', // deep moonstone
  '#7fa779', // sage
  '#c9787f', // dusty rose
  '#6c7fb8', // slate blue
  '#b98b5a', // toffee
  '#5fbfb0', // seafoam
  '#9a7aa8', // heather
] as const;

export const ACCOUNT_COLORS = ['#4c9db0', '#e0a93b', '#5fbfb0', '#d9734e', '#9a7aa8', '#7fa779'] as const;

/** Old (pre-palette) colours → new ones, so saved data recolours on load. */
export const LEGACY_COLOR_MAP: Record<string, string> = {
  '#d6f45c': '#4c9db0',
  '#7cc4ff': '#e0a93b',
  '#ff9f7a': '#d9734e',
  '#b9a4ff': '#2f6f7e',
  '#5bd6b0': '#7fa779',
  '#f2c14e': '#c9787f',
  '#ff7aa8': '#6c7fb8',
  '#8fa3b8': '#b98b5a',
  '#c9a27c': '#5fbfb0',
  '#6fe3e3': '#9a7aa8',
};
