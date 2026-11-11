import { isBlock } from '@replays/domain/value-objects/block-shape';
import type { StationBlock } from '@replays/domain/value-objects/station-block.vo';

const STATION_CHANGE_TEST_MODES = ['test', 'search'] as const;

export type StationChangeTestMode = (typeof STATION_CHANGE_TEST_MODES)[number];

const DEFAULT_MODE: StationChangeTestMode = 'test';

export const stationChangeTestModeOf = (
  raw: string | null,
): StationChangeTestMode | null =>
  raw === null
    ? DEFAULT_MODE
    : (STATION_CHANGE_TEST_MODES.find((each) => each === raw) ?? null);

export const admitsStation = (
  improved: { readonly lineKey: string; readonly stationKey: string },
  asked: { readonly line: string | null; readonly station: string | null },
): boolean =>
  (asked.line === null || asked.line === improved.lineKey) &&
  (asked.station === null || asked.station === improved.stationKey);

export const completedFrom = (seed: StationBlock, asked: unknown): unknown =>
  isBlock(asked) ? { ...seed.value, ...asked } : asked;
