import type { CausalChain } from '@integrations/domain/value-objects/causal-chain.vo';

export const CAUSATION = Symbol('CAUSATION');

export interface CausationPort {
  current(): CausalChain;

  runWith<T>(chain: CausalChain, work: () => Promise<T>): Promise<T>;
}
