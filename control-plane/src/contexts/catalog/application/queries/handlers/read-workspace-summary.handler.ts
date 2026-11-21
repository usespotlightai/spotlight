import type { WorkspaceSummaryDto } from '@catalog/application/dto/workspace-summary.dto';
import { WorkspaceSummaryMapper } from '@catalog/application/mappers/workspace-summary.mapper';
import type { WorkspacePlansPort } from '@catalog/application/ports/workspace-plans.port';
import type { ReadWorkspaceSummaryQuery } from '@catalog/application/queries/read-workspace-summary.query';
import type { WorkspaceDirectoryPort } from '@identity/application/ports/workspace-directory.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ReadWorkspaceSummaryHandler implements QueryHandlerPort<
  ReadWorkspaceSummaryQuery,
  WorkspaceSummaryDto | null
> {
  constructor(
    private readonly directory: WorkspaceDirectoryPort,
    private readonly plans: WorkspacePlansPort,
  ) {}

  async execute(
    query: ReadWorkspaceSummaryQuery,
  ): Promise<WorkspaceSummaryDto | null> {
    try {
      const workspace = await this.directory.find(
        WorkspaceId.of(query.workspaceId),
      );

      return workspace
        ? WorkspaceSummaryMapper.toDto(
            workspace,
            await this.plans.of(workspace.id),
          )
        : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
