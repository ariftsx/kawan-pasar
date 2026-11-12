/** 8-pt grid (v0.4 "Spasi & radius"). */
export const space = [4, 8, 12, 16, 24, 32, 48, 56, 80] as const;

export const radius = { sm: 8, md: 14, lg: 20, xl: 24, '2xl': 32, full: 9999 } as const;

/** Mobile < sm, tablet sm–lg, desktop ≥ lg. */
export const breakpoints = { sm: 640, lg: 1024 } as const;

export const contentMaxPx = 1280;
