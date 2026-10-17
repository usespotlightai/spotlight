import type { WorkspaceTokenTrustWithdrawn } from '@identity/domain/events/workspace-token-trust-withdrawn.event';
import { WorkspaceTokenVersionConflictError } from '@identity/domain/exceptions/workspace-token-version-conflict.error';
import type { WorkspaceTokenRepository } from '@identity/domain/repositories/workspace-token.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';

const PRUNED_AT_ONCE = 100;

export class MintedTokens {
  readonly name = 'Revoking and pruning tokens minted through a trust';

  constructor(
    private readonly tokens: WorkspaceTokenRepository,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async revokeThrough(withdrawn: WorkspaceTokenTrustWithdrawn): Promise<void> {
    const by = Attribution.spotlight(withdrawn.workspaceId);

    for (const token of await this.tokens.mintedThrough(withdrawn.trustId)) {
      await this.ignoringVersionConflict(() =>
        this.transaction.inTransaction(() =>
          this.tokens.save(token.revoke(by)),
        ),
      );
    }
  }

  async pruneExpired(): Promise<number> {
    const now = this.clock.now();
    const expired = await this.tokens.mintedAndExpiredBy(now, PRUNED_AT_ONCE);

    for (const token of expired) {
      await this.ignoringVersionConflict(() =>
        this.transaction.inTransaction(() =>
          this.tokens.save(token.lapsed(now)),
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
