import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { InferenceEndpointResourceDto } from '@inference/application/dto/inference-endpoint-resource.dto';
import { InferenceEndpointResourceMapper } from '@inference/application/mappers/inference-endpoint-resource.mapper';
import type { ReadInferenceEndpointQuery } from '@inference/application/queries/inference-endpoint.queries';
import type { InferenceEndpointRepository } from '@inference/domain/repositories/inference-endpoint.repository';
import { InferenceEndpointId } from '@inference/domain/value-objects/inference-endpoint-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadInferenceEndpointHandler implements QueryHandlerPort<
  ReadInferenceEndpointQuery,
  InferenceEndpointResourceDto | null
> {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly endpoints: InferenceEndpointRepository,
  ) {}

  async execute(
    query: ReadInferenceEndpointQuery,
  ): Promise<InferenceEndpointResourceDto | null> {
    try {
      const found = await this.endpoints.find(
        InferenceEndpointId.of(query.inferenceEndpointId),
      );
      const permissions = found
        ? await this.access.permissionsIn(found.workspaceId, query.principal)
        : null;

      return found && permissions
        ? InferenceEndpointResourceMapper.resource(found, permissions.slug)
        : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
