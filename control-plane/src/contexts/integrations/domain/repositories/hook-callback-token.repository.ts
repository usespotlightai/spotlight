import type { HookCallbackToken } from '@integrations/domain/aggregates/hook-callback-token.aggregate';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export const HOOK_CALLBACK_TOKENS = Symbol('HOOK_CALLBACK_TOKENS');

export interface HookCallbackTokenRepository {
  add(callbackToken: HookCallbackToken): Promise<void>;

  withToken(hash: TokenHash): Promise<HookCallbackToken | null>;

  expiredBefore(at: Date, max: number): Promise<readonly HookCallbackToken[]>;

  remove(callbackToken: HookCallbackToken): Promise<void>;
}
