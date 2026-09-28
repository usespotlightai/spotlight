import type { HookFiring } from '@integrations/domain/aggregates/hook-firing.aggregate';
import type { CausalChain } from '@shared-kernel/domain/value-objects/causal-chain.vo';

export const HOOK_FIRING_HISTORY = Symbol('HOOK_FIRING_HISTORY');

export const CAUSE_HEADER = 'spotlight-cause';

export interface HookFiringHistoryPort {
  recentRepeats(firing: HookFiring): Promise<number>;

  chainOf(workspaceId: string, firingId: string): Promise<CausalChain | null>;
}
