import type { WorkspaceTokenTrustWithdrawn } from '@identity/domain/events/workspace-token-trust-withdrawn.event';
import { WorkspaceTokenMovedOnError } from '@identity/domain/exceptions/workspace-token-moved-on.error';
import type { WorkspaceTokenRepository } from '@identity/domain/repositories/workspace-token.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';

const PRUNED_AT_ONCE = 100;

export class MintedTokens {
  readonly name = 'Letting go of tokens minted through a trust';

  constructor(
    private readonly tokens: WorkspaceTokenRepository,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async revokeThrough(withdrawn: WorkspaceTokenTrustWithdrawn): Promise<void> {
    const by = Attribution.spotlight(withdrawn.workspaceId);

    for (const token of await this.tokens.mintedThrough(withdrawn.trustId)) {
      await this.settled(() =>
        this.transaction.run(() => this.tokens.save(token.revoked(by))),
      );
    }
  }

  async pruneExpired(): Promise<number> {
    const now = this.clock.now();
    const expired = await this.tokens.mintedAndExpiredBy(now, PRUNED_AT_ONCE);

    for (const token of expired) {
      await this.settled(() =>
        this.transaction.run(() => this.tokens.save(token.lapsed(now))),
      );
    }

    return expired.length;
  }

  private async settled(write: () => Promise<void>): Promise<void> {
    try {
      await write();
    } catch (error) {
      if (!(error instanceof WorkspaceTokenMovedOnError)) {
        throw error;
      }
    }
  }
}
