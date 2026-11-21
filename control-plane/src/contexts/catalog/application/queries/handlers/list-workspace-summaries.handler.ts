import type { WorkspaceSummaryPageDto } from '@catalog/application/dto/workspace-summary.dto';
import { WorkspaceSummaryMapper } from '@catalog/application/mappers/workspace-summary.mapper';
import type { WorkspaceDirectoryPort } from '@catalog/application/ports/workspace-directory.port';
import type { WorkspacePlansPort } from '@catalog/application/ports/workspace-plans.port';
import type { ListWorkspaceSummariesQuery } from '@catalog/application/queries/list-workspace-summaries.query';
import { PlanTerm } from '@catalog/domain/value-objects/plan-term.vo';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ListWorkspaceSummariesHandler implements QueryHandlerPort<
  ListWorkspaceSummariesQuery,
  WorkspaceSummaryPageDto
> {
  constructor(
    private readonly directory: WorkspaceDirectoryPort,
    private readonly plans: WorkspacePlansPort,
  ) {}

  async execute(
    query: ListWorkspaceSummariesQuery,
  ): Promise<WorkspaceSummaryPageDto> {
    const page = await this.directory.list({
      after: query.after,
      limit: query.limit,
      createdAfter: query.createdAfter,
    });
    const terms = await this.plans.storedOf(page.items.map((each) => each.id));

    return {
      items: page.items.map((workspace) =>
        WorkspaceSummaryMapper.toDto(
          workspace,
          terms.get(workspace.id.value) ?? PlanTerm.free,
        ),
      ),
      next: page.next,
    };
  }
}
