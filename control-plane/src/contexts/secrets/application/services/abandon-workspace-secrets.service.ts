import type { SecretRepository } from '@secrets/domain/repositories/secret.repository';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class AbandonWorkspaceSecrets {
  constructor(
    private readonly secrets: SecretRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async of(workspaceId: WorkspaceId): Promise<void> {
    const by = Attribution.spotlight(workspaceId);

    for (const secret of await this.secrets.inWorkspace(workspaceId)) {
      await this.transaction.inTransaction(() =>
        this.secrets.save(secret.abandon(by)),
      );
    }
  }
}
