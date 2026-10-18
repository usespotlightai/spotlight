export const KAPPA_READINGS = [
  'almost-perfect',
  'substantial',
  'moderate',
  'fair-to-slight',
  'poor',
] as const;

export type KappaReading = (typeof KAPPA_READINGS)[number];

export const CORRELATION_READINGS = [
  'very-strong',
  'strong',
  'moderate',
  'weak',
  'inverse',
] as const;

export type CorrelationReading = (typeof CORRELATION_READINGS)[number];

const KAPPA_BANDS: readonly (readonly [number, KappaReading])[] = [
  [0.81, 'almost-perfect'],
  [0.61, 'substantial'],
  [0.41, 'moderate'],
  [0, 'fair-to-slight'],
];

const CORRELATION_BANDS: readonly (readonly [number, CorrelationReading])[] = [
  [0.9, 'very-strong'],
  [0.7, 'strong'],
  [0.5, 'moderate'],
  [0, 'weak'],
];

const readingOf = <Reading extends string>(
  value: number | null,
  bands: readonly (readonly [number, Reading])[],
  below: Reading,
): Reading | null =>
  value === null ? null : (bands.find(([from]) => value >= from)?.[1] ?? below);

export const kappaReadingOf = (kappa: number | null): KappaReading | null =>
  readingOf(kappa, KAPPA_BANDS, 'poor');

export const correlationReadingOf = (
  correlation: number | null,
): CorrelationReading | null =>
  readingOf(correlation, CORRELATION_BANDS, 'inverse');
