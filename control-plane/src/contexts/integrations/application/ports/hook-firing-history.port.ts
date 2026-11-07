import type { HookFiringRepeats } from '@integrations/domain/aggregates/hook-firing.aggregate';
import type { HookFiringId } from '@integrations/domain/value-objects/hook-firing-id.vo';
import type { CausalChain } from '@shared-kernel/domain/value-objects/causal-chain.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const HOOK_FIRING_HISTORY = Symbol('HOOK_FIRING_HISTORY');

export interface HookFiringHistoryPort {
  recentRepeats(repeats: HookFiringRepeats): Promise<number>;

  chainOf(
    workspaceId: WorkspaceId,
    firingId: HookFiringId,
  ): Promise<CausalChain | null>;
}
