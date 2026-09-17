import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const LINKED_ACCOUNTS = Symbol('LINKED_ACCOUNTS');

export type LinkedProvider = 'github';

export interface LinkedAccountsPort {
  tokenFor(userId: UserId, provider: LinkedProvider): Promise<string | null>;
}
