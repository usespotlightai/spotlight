import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

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

export const samplePointOf = (seed: string, runId: RunId): number => {
  let hash = OFFSET;

  for (const char of `${seed}:${runId.value}`) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, PRIME) >>> 0;
  }

  return mixed(hash) / SPAN;
};

const within = (rate: number, point: number): boolean =>
  rate >= 1 || (rate > 0 && point < rate);

export const sampledForJudging = (runId: RunId, sample: number): boolean =>
  within(sample, samplePointOf('judge', runId));
