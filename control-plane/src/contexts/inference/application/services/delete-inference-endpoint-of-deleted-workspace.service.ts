import type { InferenceResolutionPort } from '@inference/application/ports/inference-resolution.port';
import type { InferenceEndpointRepository } from '@inference/domain/repositories/inference-endpoint.repository';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class DeleteInferenceEndpointOfDeletedWorkspace {
  constructor(
    private readonly endpoints: InferenceEndpointRepository,
    private readonly resolution: InferenceResolutionPort,
    private readonly transaction: TransactionPort,
  ) {}

  async deleteForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    const endpoint = await this.endpoints.ofWorkspace(workspaceId);

    if (endpoint) {
      await this.transaction.inTransaction(() =>
        this.endpoints.save(endpoint.delete()),
      );
    }

    this.resolution.forget(workspaceId.value);
  }
}
