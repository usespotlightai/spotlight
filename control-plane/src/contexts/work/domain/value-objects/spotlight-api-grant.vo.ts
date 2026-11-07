import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

const SCOPES = ['plan'] as const;

const LIFETIME_MS = 60 * 60 * 1_000;

export class SpotlightApiGrant {
  private constructor(
    readonly issuedBy: UserId,
    readonly scopes: readonly string[],
    readonly expiresAt: Date,
  ) {}

  static forChatRun(startedBy: UserId, now: Date): SpotlightApiGrant {
    return new SpotlightApiGrant(
      startedBy,
      SCOPES,
      new Date(now.getTime() + LIFETIME_MS),
    );
  }
}
