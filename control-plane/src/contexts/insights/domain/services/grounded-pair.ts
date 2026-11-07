import { MAX_REASONS } from '@insights/domain/services/grounded-verdict';
import type {
  PairCitedReason,
  PairEvidence,
} from '@insights/domain/services/pair-evidence';
import {
  PAIR_LABELS,
  type PairLabel,
  type PairWinner,
  winnerOf,
} from '@insights/domain/value-objects/pair-order';
import type { PairReason } from '@insights/domain/value-objects/pair-reason.vo';

export interface PairVerdict {
  readonly preferred: PairLabel;
  readonly reasons: readonly PairCitedReason[];
}

export interface PairShown {
  readonly verdict: PairVerdict;
  readonly evidence: PairEvidence;
}

export interface PairPass {
  readonly runShownFirst: boolean;
  readonly winner: PairWinner;
  readonly reasons: readonly PairReason[];
}

export type GroundedPair =
  | { readonly grounded: true; readonly passes: readonly PairPass[] }
  | { readonly grounded: false; readonly failure: 'unreadable' | 'ungrounded' };

const UNREADABLE = 'unreadable';

const UNGROUNDED = 'ungrounded';

const passOf = (
  shown: PairShown,
): PairPass | typeof UNREADABLE | typeof UNGROUNDED => {
  const stated = shown.verdict.reasons;

  if (
    !PAIR_LABELS.includes(shown.verdict.preferred) ||
    stated.length === 0 ||
    stated.length > MAX_REASONS
  ) {
    return UNREADABLE;
  }

  const reasons = shown.evidence.groundedReasons(stated);

  if (reasons.length * 2 <= stated.length) {
    return UNGROUNDED;
  }

  return {
    runShownFirst: shown.evidence.order === 'run-first',
    winner: winnerOf(shown.evidence.order, shown.verdict.preferred),
    reasons,
  };
};

export const groundedPair = (shown: readonly PairShown[]): GroundedPair => {
  const checked = shown.map(passOf);

  if (checked.some((each) => each === UNREADABLE)) {
    return { grounded: false, failure: UNREADABLE };
  }

  const passes = checked.filter(
    (each): each is PairPass => typeof each !== 'string',
  );

  return passes.length === checked.length
    ? { grounded: true, passes }
    : { grounded: false, failure: UNGROUNDED };
};
