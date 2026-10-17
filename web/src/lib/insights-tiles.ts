const IN_A_ROW: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
  7: 'lg:grid-cols-7',
};

export const tilesInARow = (count: number): string =>
  IN_A_ROW[count] ?? 'lg:grid-cols-4';

export type TileBones = {
  readonly label: string | null;
  readonly note?: string;
  readonly wide?: boolean;
  readonly delta?: boolean;
  readonly detail?: boolean | string;
  readonly trend?: boolean;
};

export const TALLY_TILES: readonly TileBones[] = [
  { label: 'Runs', delta: true, trend: true },
  { label: 'Failed', delta: true, detail: true, trend: true },
  { label: 'Accepted', delta: true },
  { label: 'Sent back', delta: true },
  { label: 'Merged', delta: true },
  { label: 'Cost', wide: true, delta: true },
  { label: 'Median run', delta: true, detail: true },
];
