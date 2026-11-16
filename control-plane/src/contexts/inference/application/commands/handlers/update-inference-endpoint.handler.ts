import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { UpdateInferenceEndpointCommand } from '@inference/application/commands/inference-endpoint.commands';
import type { InferenceEndpointUpdated } from '@inference/application/dto/inference-endpoint-resource.dto';
import type { InferenceEndpointDefinitionsPort } from '@inference/application/ports/inference-endpoint-definitions.port';
import type { InferenceResolutionPort } from '@inference/application/ports/inference-resolution.port';
import type { InferenceTransportPort } from '@inference/application/ports/inference-transport.port';
import {
  INFERENCE_KEY_SECRET,
  InferenceProblems,
} from '@inference/application/rendering/inference-problems';
import { appliedEndpointWarnings } from '@inference/application/services/applied-endpoint-probe';
import type { InferenceEndpoint } from '@inference/domain/aggregates/inference-endpoint.aggregate';
import { InferenceEndpointVersionConflictError } from '@inference/domain/exceptions/inference-endpoint-version-conflict.error';
import { InvalidInferenceEndpointError } from '@inference/domain/exceptions/invalid-inference-endpoint.error';
import type { InferenceEndpointRepository } from '@inference/domain/repositories/inference-endpoint.repository';
import { InferenceEndpointId } from '@inference/domain/value-objects/inference-endpoint-id.vo';
import type { WorkspaceSecretsPort } from '@secrets/application/ports/workspace-secrets.port';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';

export class UpdateInferenceEndpointHandler implements CommandHandlerPort<
  UpdateInferenceEndpointCommand,
  InferenceEndpointUpdated | null
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
  ): Promise<InferenceEndpointUpdated | null> {
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

      const updated = existing.update(
        {
          baseUrl: compiled.baseUrl,
          model: compiled.model,
          apiKeyVersion: compiled.apiKeyVersion,
        },
        compiled.apiKey !== null,
        ChangeActor.of(command.actor, permissions.workspaceId),
      );

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

      await this.transaction.inTransaction(async () => {
        await this.endpoints.save(updated);

        if (updated.apiKeyWrite === 'store' && compiled.apiKey) {
          await this.secrets.store({
            workspaceId: existing.workspaceId.value,
            name: INFERENCE_KEY_SECRET,
            value: compiled.apiKey,
          });
        }

        if (updated.apiKeyWrite === 'remove') {
          await this.secrets.remove(
            existing.workspaceId.value,
            INFERENCE_KEY_SECRET,
          );
        }
      });
      this.resolution.forget(existing.workspaceId.value);

      const workspaceId = existing.workspaceId.value;
      const warnings = await appliedEndpointWarnings(
        this.transport,
        workspaceId,
        async () => ({
          baseUrl: compiled.baseUrl.value,
          model: compiled.model.value,
          apiKey: await this.apiKeyOf(updated, compiled.apiKey),
        }),
      );

      return { outcome: 'updated', id: id.value, warnings };
    } catch (error) {
      if (error instanceof InferenceEndpointVersionConflictError) {
        const current = await this.endpoints.find(id);

        return current
          ? { outcome: 'version-conflict', currentVersion: current.version }
          : null;
      }

      if (error instanceof InvalidInferenceEndpointError) {
        return {
          outcome: 'invalid',
          problems: [InferenceProblems.invalid(error)],
        };
      }

      rethrowAsApplicationError(error);
    }
  }

  private async apiKeyOf(
    updated: InferenceEndpoint,
    sent: string | null,
  ): Promise<string | undefined> {
    if (updated.apiKeyWrite === 'store') {
      return sent ?? undefined;
    }

    if (!updated.hasApiKey) {
      return undefined;
    }

    return (
      (await this.secrets.reveal(
        updated.workspaceId.value,
        INFERENCE_KEY_SECRET,
      )) ?? undefined
    );
  }
}
