import type { LineResponseDto } from '@/lib/api';

export const creatingState = (): { readonly creating: number } => ({
  creating: Date.now(),
});

export const creatingOf = (state: unknown): number | null =>
  typeof state === 'object' &&
  state !== null &&
  'creating' in state &&
  typeof state.creating === 'number'
    ? state.creating
    : null;

export const entryStationOf = (line: LineResponseDto): string | null =>
  (
    line.stations.find((station) => station.kind === 'backlog') ??
    line.stations.at(0)
  )?.id ?? null;
