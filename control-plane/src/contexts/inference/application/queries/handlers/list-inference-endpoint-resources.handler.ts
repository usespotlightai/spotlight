import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { InferenceEndpointResourceDto } from '@inference/application/dto/inference-endpoint-resource.dto';
import { InferenceEndpointResourceMapper } from '@inference/application/mappers/inference-endpoint-resource.mapper';
import type { ListInferenceEndpointResourcesQuery } from '@inference/application/queries/inference-endpoint.queries';
import type { InferenceEndpointRepository } from '@inference/domain/repositories/inference-endpoint.repository';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ListInferenceEndpointResourcesHandler implements QueryHandlerPort<
  ListInferenceEndpointResourcesQuery,
  readonly InferenceEndpointResourceDto[] | null
> {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly endpoints: InferenceEndpointRepository,
  ) {}

  async execute(
    query: ListInferenceEndpointResourcesQuery,
  ): Promise<readonly InferenceEndpointResourceDto[] | null> {
    try {
      const permissions = await this.access.permissionsIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );

      if (!permissions) {
        return null;
      }

      const found = await this.endpoints.ofWorkspace(permissions.workspaceId);

      return found
        ? [InferenceEndpointResourceMapper.resource(found, permissions.slug)]
        : [];
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
