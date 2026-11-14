import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { DeleteInferenceEndpointCommand } from '@inference/application/commands/inference-endpoint.commands';
import type { InferenceResolutionPort } from '@inference/application/ports/inference-resolution.port';
import { INFERENCE_KEY_SECRET } from '@inference/application/rendering/inference-problems';
import { InferenceEndpointVersionConflictError } from '@inference/domain/exceptions/inference-endpoint-version-conflict.error';
import type { InferenceEndpointRepository } from '@inference/domain/repositories/inference-endpoint.repository';
import { InferenceEndpointId } from '@inference/domain/value-objects/inference-endpoint-id.vo';
import type { WorkspaceSecretsPort } from '@secrets/application/ports/workspace-secrets.port';
import {
  forbiddenTo,
  type ResourceDeleted,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

export class DeleteInferenceEndpointHandler implements CommandHandlerPort<
  DeleteInferenceEndpointCommand,
  ResourceDeleted | null
> {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly endpoints: InferenceEndpointRepository,
    private readonly secrets: WorkspaceSecretsPort,
    private readonly resolution: InferenceResolutionPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: DeleteInferenceEndpointCommand,
  ): Promise<ResourceDeleted | null> {
    const id = InferenceEndpointId.of(command.inferenceEndpointId);

    try {
      const existing = await this.endpoints.find(id);
      const permissions = existing
        ? await this.access.permissionsIn(
            existing.workspaceId,
            command.actor.principal,
          )
        : null;

      if (!existing || !permissions) {
        return null;
      }

      if (!permissions.scopes.has('secrets')) {
        return forbiddenTo('secrets');
      }

      existing.assertVersion(command.expectedVersion);

      await this.transaction.inTransaction(async () => {
        await this.endpoints.save(existing.delete());
        await this.secrets.remove(
          existing.workspaceId.value,
          INFERENCE_KEY_SECRET,
        );
      });
      this.resolution.forget(existing.workspaceId.value);

      return { outcome: 'deleted' };
    } catch (error) {
      if (error instanceof InferenceEndpointVersionConflictError) {
        const current = await this.endpoints.find(id);

        return current
          ? { outcome: 'version-conflict', currentVersion: current.version }
          : null;
      }

      rethrowAsApplicationError(error);
    }
  }
}
