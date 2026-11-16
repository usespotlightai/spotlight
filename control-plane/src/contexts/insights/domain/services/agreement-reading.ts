export const KAPPA_READINGS = [
  'almost-perfect',
  'substantial',
  'moderate',
  'fair',
  'slight',
  'chance',
] as const;

export type KappaReading = (typeof KAPPA_READINGS)[number];

const KAPPA_BANDS: readonly (readonly [number, KappaReading])[] = [
  [0.81, 'almost-perfect'],
  [0.61, 'substantial'],
  [0.41, 'moderate'],
  [0.21, 'fair'],
  [0.01, 'slight'],
];

export const kappaReadingOf = (kappa: number | null): KappaReading | null =>
  kappa === null
    ? null
    : (KAPPA_BANDS.find(([from]) => kappa >= from)?.[1] ?? 'chance');
