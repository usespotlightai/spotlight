import type { JudgeVerdict } from '@replays/domain/value-objects/judge-verdict.vo';

interface JudgedTwice {
  readonly judging: { readonly verdict: JudgeVerdict | null } | null;
  readonly secondJudging: { readonly verdict: JudgeVerdict | null } | null;
}

export interface ClaimFlips {
  readonly claim: string;
  readonly flipped: number;
}

const sameClaims = (one: JudgeVerdict, other: JudgeVerdict): boolean =>
  one.claims.length === other.claims.length &&
  one.claims.every((claim, at) => claim === other.claims[at]);

export const claimFlipsOf = (
  entries: readonly JudgedTwice[],
): readonly ClaimFlips[] => {
  const flips = new Map<string, number>();

  for (const entry of entries) {
    const first = entry.judging?.verdict;
    const second = entry.secondJudging?.verdict;

    if (!first || !second || !sameClaims(first, second)) {
      continue;
    }

    first.claims.forEach((claim, at) => {
      if (first.claimResults[at] !== second.claimResults[at]) {
        flips.set(claim, (flips.get(claim) ?? 0) + 1);
      }
    });
  }

  return [...flips]
    .map(([claim, flipped]) => ({ claim, flipped }))
    .sort((one, other) => other.flipped - one.flipped);
};
