import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const CHAT_RUN_API_SCOPES = ['plan'] as const;

export const CHAT_RUN_API_LIFETIME_MS = 60 * 60 * 1_000;

export class SpotlightApiGrant {
  private constructor(
    readonly issuedBy: UserId,
    readonly scopes: readonly string[],
    readonly expiresAt: Date,
  ) {}

  static forChatRun(startedBy: UserId, now: Date): SpotlightApiGrant {
    return new SpotlightApiGrant(
      startedBy,
      CHAT_RUN_API_SCOPES,
      new Date(now.getTime() + CHAT_RUN_API_LIFETIME_MS),
    );
  }
}
