import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { RunnerTrustResourceDto } from '@runners/application/dto/runner-resource.dto';
import { RunnerResourceMapper } from '@runners/application/mappers/runner-resource.mapper';
import type { RunnerResourcesPort } from '@runners/application/ports/runner-resources.port';
import type { ImportRunnerTrustQuery } from '@runners/application/queries/runner-resource.queries';
import { TrustKey } from '@runners/domain/value-objects/trust-key.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ImportRunnerTrustHandler
  implements
    QueryHandlerPort<ImportRunnerTrustQuery, RunnerTrustResourceDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: RunnerResourcesPort,
  ) {}

  async execute(
    query: ImportRunnerTrustQuery,
  ): Promise<RunnerTrustResourceDto | null> {
    try {
      const permissions = await this.access.permissionsIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );
      const kept = permissions
        ? await this.resources.trustAt(
            permissions.workspaceId,
            TrustKey.of(query.address).value,
          )
        : null;

      return kept ? RunnerResourceMapper.trust(kept) : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
