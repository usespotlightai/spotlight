import type { HookCallbackToken } from '@integrations/domain/aggregates/hook-callback-token.aggregate';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export const HOOK_CALLBACK_TOKENS = Symbol('HOOK_CALLBACK_TOKENS');

export interface HookCallbackTokenRepository {
  add(callbackToken: HookCallbackToken): Promise<void>;

  withToken(hash: TokenHash): Promise<HookCallbackToken | null>;

  purgeExpiringBefore(at: Date): Promise<void>;
}
