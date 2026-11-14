import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { UpdateInferenceEndpointCommand } from '@inference/application/commands/inference-endpoint.commands';
import type { InferenceEndpointDefinitionsPort } from '@inference/application/ports/inference-endpoint-definitions.port';
import type { InferenceResolutionPort } from '@inference/application/ports/inference-resolution.port';
import type { InferenceTransportPort } from '@inference/application/ports/inference-transport.port';
import {
  INFERENCE_KEY_SECRET,
  InferenceProblems,
} from '@inference/application/rendering/inference-problems';
import { definitionOf } from '@inference/application/services/inference-endpoint-key';
import { InferenceEndpointVersionConflictError } from '@inference/domain/exceptions/inference-endpoint-version-conflict.error';
import type { InferenceEndpointRepository } from '@inference/domain/repositories/inference-endpoint.repository';
import { InferenceEndpointId } from '@inference/domain/value-objects/inference-endpoint-id.vo';
import type { WorkspaceSecretsPort } from '@secrets/application/ports/workspace-secrets.port';
import {
  forbiddenTo,
  type ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

export class UpdateInferenceEndpointHandler implements CommandHandlerPort<
  UpdateInferenceEndpointCommand,
  ResourceUpdated | null
> {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly definitions: InferenceEndpointDefinitionsPort,
    private readonly endpoints: InferenceEndpointRepository,
    private readonly secrets: WorkspaceSecretsPort,
    private readonly transport: InferenceTransportPort,
    private readonly resolution: InferenceResolutionPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: UpdateInferenceEndpointCommand,
  ): Promise<ResourceUpdated | null> {
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

      const compiled = this.definitions.endpoint(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      const refusal = await this.transport.refusalOf(
        existing.workspaceId.value,
        compiled.baseUrl.value,
      );

      if (refusal) {
        return {
          outcome: 'invalid',
          problems: [InferenceProblems.refused(refusal)],
        };
      }

      const updated = existing.update(
        definitionOf(compiled, existing.definition.apiKeyVersion),
      );

      await this.transaction.inTransaction(async () => {
        await this.endpoints.save(updated);

        if (compiled.apiKey) {
          await this.secrets.store({
            workspaceId: existing.workspaceId.value,
            name: INFERENCE_KEY_SECRET,
            value: compiled.apiKey,
          });
        }
      });
      this.resolution.forget(existing.workspaceId.value);

      return { outcome: 'updated', id: id.value };
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
