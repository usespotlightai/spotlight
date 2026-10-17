import type {
  CausalChain,
  CauseLink,
} from '@shared-kernel/domain/value-objects/causal-chain.vo';

export const MAX_DEPTH = 8;

const MAX_RECENT_REPEATS = 3;

export const RECENT_MS = 10 * 60 * 1000;

export type LoopStop =
  | { readonly kind: 'too-deep'; readonly saying: string }
  | { readonly kind: 'repeated'; readonly saying: string }
  | { readonly kind: 'recurring'; readonly saying: string };

export const loopStopFor = (input: {
  chain: CausalChain;
  firing: CauseLink;
  recentRepeats: number;
}): LoopStop | null => {
  const named = input.chain.started
    ? `${input.chain.saying} → ${input.firing.saying}`
    : input.firing.saying;

  if (input.chain.contains(input.firing.key)) {
    return {
      kind: 'repeated',
      saying: `It would fire again for the change that caused it. Cause chain: ${named}`,
    };
  }

  if (input.chain.depth >= MAX_DEPTH) {
    return {
      kind: 'too-deep',
      saying: `Its chain of causes would be ${input.chain.depth + 1} deep. Maximum depth: ${MAX_DEPTH}. Cause chain: ${named}`,
    };
  }

  if (input.recentRepeats >= MAX_RECENT_REPEATS) {
    return {
      kind: 'recurring',
      saying: `It fired ${input.recentRepeats} times for the same change in the last ${RECENT_MS / 60_000} minutes. Cause chain: ${named}`,
    };
  }

  return null;
};
