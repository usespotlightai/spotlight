const GRIDS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-2 *:last:col-span-2 @xl/pane:grid-cols-3 @xl/pane:*:last:col-span-1',
  4: 'grid-cols-2 @4xl/pane:grid-cols-4',
  5: 'grid-cols-2 *:last:col-span-2 @xl/pane:grid-cols-6 @xl/pane:*:col-span-2 @xl/pane:*:nth-last-[-n+2]:col-span-3 @4xl/pane:grid-cols-5 @4xl/pane:*:col-span-1 @4xl/pane:*:nth-last-[-n+2]:col-span-1',
  6: 'grid-cols-2 @xl/pane:grid-cols-3 @4xl/pane:grid-cols-6',
  7: 'grid-cols-2 *:last:col-span-2 @xl/pane:grid-cols-4 @5xl/pane:grid-cols-7 @5xl/pane:*:last:col-span-1',
};

export const tileGridOf = (count: number): string =>
  GRIDS[count] ?? 'grid-cols-2 @xl/pane:grid-cols-3 @4xl/pane:grid-cols-4';

export type TileBones = {
  readonly label: string | null;
  readonly tooltip?: string;
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
