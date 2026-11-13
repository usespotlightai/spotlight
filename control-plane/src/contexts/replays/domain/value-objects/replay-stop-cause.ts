import type { Unjudged } from '@replays/domain/value-objects/entry-judging.vo';
import type { Unpaired } from '@replays/domain/value-objects/entry-pairing.vo';

export const REPLAY_STOP_CAUSES = [
  'superseded',
  'insufficient-credits',
  'search-ended',
  'stale',
  'check-failed',
] as const;

export type ReplayStopCause = (typeof REPLAY_STOP_CAUSES)[number];

const HALTS_JUDGING: Partial<
  Readonly<Record<Unjudged | Unpaired, ReplayStopCause>>
> = {
  'insufficient-credits': 'insufficient-credits',
};

export const haltingCause = (
  why: Unjudged | Unpaired,
): ReplayStopCause | null => HALTS_JUDGING[why] ?? null;
