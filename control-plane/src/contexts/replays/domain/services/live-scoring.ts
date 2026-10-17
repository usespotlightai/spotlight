import { sameField } from '@replays/domain/services/field-comparison';
import { isBlock } from '@replays/domain/value-objects/block-shape';
import type { StationBlock } from '@replays/domain/value-objects/station-block.vo';

export const SCORING_FIELDS = ['check', 'judge', 'diffs', 'runners'] as const;

export type ScoringField = (typeof SCORING_FIELDS)[number];

const DERIVED_WHEN_LEFT_OUT: readonly ScoringField[] = ['diffs'];

export interface ScoredLive {
  readonly block: unknown;
  readonly keptLive: readonly ScoringField[];
}

const changes = (
  planned: Readonly<Record<string, unknown>>,
  live: Readonly<Record<string, unknown>>,
  field: ScoringField,
): boolean =>
  (planned[field] !== undefined || !DERIVED_WHEN_LEFT_OUT.includes(field)) &&
  !sameField(planned[field], live[field], { emptyIsUnset: true });

export const scoredLive = (
  planned: unknown,
  live: StationBlock,
): ScoredLive => {
  if (!isBlock(planned)) {
    return { block: planned, keptLive: [] };
  }

  const liveBlock = live.value;
  const block: Record<string, unknown> = { ...planned };

  for (const field of SCORING_FIELDS) {
    if (liveBlock[field] === undefined) {
      delete block[field];
    } else {
      block[field] = liveBlock[field];
    }
  }

  return {
    block,
    keptLive: SCORING_FIELDS.filter((field) =>
      changes(planned, liveBlock, field),
    ),
  };
};
