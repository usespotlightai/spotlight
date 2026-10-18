import type {
  CausalChain,
  CauseLink,
} from '@shared-kernel/domain/value-objects/causal-chain.vo';

export const MAX_DEPTH = 8;

const MAX_RECENT_REPEATS = 3;

export const RECENT_MS = 10 * 60 * 1000;

export type LoopStop =
  | { readonly kind: 'too-deep'; readonly description: string }
  | { readonly kind: 'repeated'; readonly description: string }
  | { readonly kind: 'recurring'; readonly description: string };

export const loopStopFor = (input: {
  chain: CausalChain;
  firing: CauseLink;
  recentRepeats: number;
}): LoopStop | null => {
  const named = input.chain.started
    ? `${input.chain.description} → ${input.firing.description}`
    : input.firing.description;

  if (input.chain.contains(input.firing.key)) {
    return {
      kind: 'repeated',
      description: `It would fire again for the change that caused it. Cause chain: ${named}`,
    };
  }

  if (input.chain.depth >= MAX_DEPTH) {
    return {
      kind: 'too-deep',
      description: `Its chain of causes would be ${input.chain.depth + 1} deep. Maximum depth: ${MAX_DEPTH}. Cause chain: ${named}`,
    };
  }

  if (input.recentRepeats >= MAX_RECENT_REPEATS) {
    return {
      kind: 'recurring',
      description: `It fired ${input.recentRepeats} times for the same change in the last ${RECENT_MS / 60_000} minutes. Cause chain: ${named}`,
    };
  }

  return null;
};
