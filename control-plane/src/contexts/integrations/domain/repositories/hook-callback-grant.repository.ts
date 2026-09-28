import type { HookCallbackGrant } from '@integrations/domain/aggregates/hook-callback-grant.aggregate';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export const HOOK_CALLBACK_GRANTS = Symbol('HOOK_CALLBACK_GRANTS');

export interface HookCallbackGrantRepository {
  add(grant: HookCallbackGrant): Promise<void>;

  withToken(hash: TokenHash): Promise<HookCallbackGrant | null>;

  forgetExpiringBefore(at: Date): Promise<void>;
}
