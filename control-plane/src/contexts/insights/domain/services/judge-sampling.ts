import type { RunEnding } from '@insights/domain/value-objects/run-ending';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const GRADING_RATE = 0.2;

const OFFSET = 0x811c9dc5;

const PRIME = 0x01000193;

const SPAN = 2 ** 32;

const mixed = (hash: number): number => {
  let mixing = hash;
  mixing ^= mixing >>> 16;
  mixing = Math.imul(mixing, 0x85ebca6b);
  mixing ^= mixing >>> 13;
  mixing = Math.imul(mixing, 0xc2b2ae35);
  mixing ^= mixing >>> 16;
  return mixing >>> 0;
};

const pointOf = (seed: string, runId: RunId): number => {
  let hash = OFFSET;

  for (const char of `${seed}:${runId.value}`) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, PRIME) >>> 0;
  }

  return mixed(hash) / SPAN;
};

const within = (rate: number, point: number): boolean =>
  rate >= 1 || (rate > 0 && point < rate);

const JUDGED_ENDINGS: readonly RunEnding[] = ['completed', 'stopped'];

export const judgesRunThatEnded = (ending: RunEnding): boolean =>
  JUDGED_ENDINGS.includes(ending);

export const sampledForJudging = (runId: RunId, sample: number): boolean =>
  within(sample, pointOf('judge', runId));

export const sampledForGrading = (runId: RunId): boolean =>
  within(GRADING_RATE, pointOf('grade', runId));
