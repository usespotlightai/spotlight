import type { CausationPort } from '@shared-kernel/application/ports/causation.port';
import { CausalChain } from '@shared-kernel/domain/value-objects/causal-chain.vo';

export const causationInMemory = (): CausationPort => {
  let current = CausalChain.none();

  return {
    current: () => current,
    within: async (chain, work) => {
      const before = current;
      current = chain;

      try {
        return await work();
      } finally {
        current = before;
      }
    },
  };
};
