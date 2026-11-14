import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { InferenceEndpointResourceDto } from '@inference/application/dto/inference-endpoint-resource.dto';
import { InferenceEndpointResourceMapper } from '@inference/application/mappers/inference-endpoint-resource.mapper';
import type { ImportInferenceEndpointQuery } from '@inference/application/queries/inference-endpoint.queries';
import type { InferenceEndpointRepository } from '@inference/domain/repositories/inference-endpoint.repository';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ImportInferenceEndpointHandler implements QueryHandlerPort<
  ImportInferenceEndpointQuery,
  InferenceEndpointResourceDto | null
> {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly endpoints: InferenceEndpointRepository,
  ) {}

  async execute(
    query: ImportInferenceEndpointQuery,
  ): Promise<InferenceEndpointResourceDto | null> {
    try {
      const permissions = await this.access.permissionsIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );
      const found =
        permissions && permissions.slug === query.address
          ? await this.endpoints.ofWorkspace(permissions.workspaceId)
          : null;

      return found && permissions
        ? InferenceEndpointResourceMapper.resource(found, permissions.slug)
        : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
