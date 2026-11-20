import type { WorkspaceSummaryPageDto } from '@catalog/application/dto/workspace-summary.dto';
import { WorkspaceSummaryMapper } from '@catalog/application/mappers/workspace-summary.mapper';
import type { WorkspacePlansPort } from '@catalog/application/ports/workspace-plans.port';
import type { WorkspacesPort } from '@catalog/application/ports/workspaces.port';
import type { ListWorkspaceSummariesQuery } from '@catalog/application/queries/list-workspace-summaries.query';
import { PlanTerm } from '@catalog/domain/value-objects/plan-term.vo';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ListWorkspaceSummariesHandler implements QueryHandlerPort<
  ListWorkspaceSummariesQuery,
  WorkspaceSummaryPageDto
> {
  constructor(
    private readonly workspaces: WorkspacesPort,
    private readonly plans: WorkspacePlansPort,
  ) {}

  async execute(
    query: ListWorkspaceSummariesQuery,
  ): Promise<WorkspaceSummaryPageDto> {
    const page = await this.workspaces.list({
      after: query.after,
      limit: query.limit,
      createdAfter: query.createdAfter,
    });
    const terms = await this.plans.ofEach(page.items.map((each) => each.id));

    return {
      items: page.items.map((workspace) =>
        WorkspaceSummaryMapper.toSummary(
          workspace,
          terms.get(workspace.id.value) ?? PlanTerm.free,
        ),
      ),
      next: page.next,
    };
  }
}
