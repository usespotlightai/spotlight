import { PROBE_REPEATS } from '@replays/domain/value-objects/replay-repeats';
import type { Spend } from '@replays/domain/value-objects/spend.vo';

export interface BaselineTerms {
  readonly probe: boolean;
  readonly repeats: number;
  readonly ceiling: Spend;
}

export const baselineTermsOf = (
  checking: boolean,
  repeats: number,
  ceiling: Spend,
): BaselineTerms => {
  if (!checking) {
    return { probe: false, repeats, ceiling };
  }

  const probing = Math.max(repeats, PROBE_REPEATS);

  return {
    probe: true,
    repeats: probing,
    ceiling: ceiling.scaledCeiling(probing, repeats),
  };
};
