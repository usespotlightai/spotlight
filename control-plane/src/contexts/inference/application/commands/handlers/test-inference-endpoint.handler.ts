import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { TestInferenceEndpointCommand } from '@inference/application/commands/inference-endpoint.commands';
import type { ConnectionTested } from '@inference/application/dto/inference-endpoint-resource.dto';
import type { InferenceEndpointDefinitionsPort } from '@inference/application/ports/inference-endpoint-definitions.port';
import type { InferenceTransportPort } from '@inference/application/ports/inference-transport.port';
import { INFERENCE_KEY_SECRET } from '@inference/application/rendering/inference-problems';
import type { WorkspaceSecretsPort } from '@secrets/application/ports/workspace-secrets.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class TestInferenceEndpointHandler implements CommandHandlerPort<
  TestInferenceEndpointCommand,
  ConnectionTested | null
> {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly definitions: InferenceEndpointDefinitionsPort,
    private readonly secrets: WorkspaceSecretsPort,
    private readonly transport: InferenceTransportPort,
  ) {}

  async execute(
    command: TestInferenceEndpointCommand,
  ): Promise<ConnectionTested | null> {
    try {
      const permissions = await this.access.permissionsIn(
        WorkspaceId.of(command.workspaceId),
        command.actor.principal,
      );

      if (!permissions) {
        return null;
      }

      if (!permissions.scopes.has('secrets')) {
        return { outcome: 'forbidden', act: 'secrets' };
      }

      const compiled = this.definitions.endpoint(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      const workspaceId = permissions.workspaceId.value;
      const apiKey =
        compiled.apiKey ??
        (await this.secrets.reveal(workspaceId, INFERENCE_KEY_SECRET)) ??
        undefined;
      const result = await this.transport.probe(workspaceId, {
        baseUrl: compiled.baseUrl.value,
        model: compiled.model.value,
        supportsReasoningEffort: compiled.supportsReasoningEffort,
        apiKey,
      });

      return { outcome: 'tested', ...result };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
