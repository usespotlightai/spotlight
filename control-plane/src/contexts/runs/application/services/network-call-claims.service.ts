import type { NetworkCall } from '@runs/domain/aggregates/network-call.aggregate';
import type { NetworkCallRepository } from '@runs/domain/repositories/network-call.repository';
import type { CallingHost } from '@runs/domain/value-objects/calling-host.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class NetworkCallClaims {
  constructor(
    private readonly calls: NetworkCallRepository,
    private readonly transaction: TransactionPort,
  ) {}

  next(
    workspaceId: WorkspaceId,
    by: CallingHost,
    now: Date,
    secretsToken: TokenHash,
  ): Promise<NetworkCall | null> {
    return this.transaction.inTransaction(async () => {
      const waiting = await this.calls.nextWaiting(workspaceId, now);

      if (!waiting) {
        return null;
      }

      const claimed = waiting.claimedBy(by, now, secretsToken);
      await this.calls.save(claimed);

      return claimed;
    });
  }
}
