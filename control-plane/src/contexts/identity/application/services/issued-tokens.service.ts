import type { WorkspaceTokenTrustDeleted } from '@identity/domain/events/workspace-token-trust-deleted.event';
import { WorkspaceTokenVersionConflictError } from '@identity/domain/exceptions/workspace-token-version-conflict.error';
import type { WorkspaceTokenRepository } from '@identity/domain/repositories/workspace-token.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';

const EXPIRE_BATCH = 100;

export class IssuedTokens {
  readonly name = 'Revoking and expiring tokens issued by a trust';

  constructor(
    private readonly tokens: WorkspaceTokenRepository,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async revokeIssuedBy(deleted: WorkspaceTokenTrustDeleted): Promise<void> {
    const by = ChangeActor.spotlight(deleted.workspaceId);

    for (const token of await this.tokens.issuedByTrust(deleted.trustId)) {
      await this.ignoringVersionConflict(() =>
        this.transaction.inTransaction(() =>
          this.tokens.save(token.revoke(by)),
        ),
      );
    }
  }

  async expireDue(): Promise<number> {
    const now = this.clock.now();
    const expired = await this.tokens.issuedAndExpiredBy(now, EXPIRE_BATCH);

    for (const token of expired) {
      await this.ignoringVersionConflict(() =>
        this.transaction.inTransaction(() =>
          this.tokens.save(token.expire(now)),
        ),
      );
    }

    return expired.length;
  }

  private async ignoringVersionConflict(
    write: () => Promise<void>,
  ): Promise<void> {
    try {
      await write();
    } catch (error) {
      if (!(error instanceof WorkspaceTokenVersionConflictError)) {
        throw error;
      }
    }
  }
}
