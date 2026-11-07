import type { CausationPort } from '@integrations/application/ports/causation.port';
import { CausalChain } from '@integrations/domain/value-objects/causal-chain.vo';

export const causationInMemory = (): CausationPort => {
  let current = CausalChain.none();

  return {
    current: () => current,
    runWith: async (chain, work) => {
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
