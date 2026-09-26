import type { CausalChain } from '@shared-kernel/domain/value-objects/causal-chain.vo';

export const CAUSATION = Symbol('CAUSATION');

export interface CausationPort {
  current(): CausalChain;

  within<T>(chain: CausalChain, work: () => Promise<T>): Promise<T>;
}
