import type { WorkspaceSummaryDto } from '@catalog/application/dto/workspace-summary.dto';
import { WorkspaceSummaryMapper } from '@catalog/application/mappers/workspace-summary.mapper';
import type { PlanTermsPort } from '@catalog/application/ports/plan-terms.port';
import type { ListWorkspaceSummariesQuery } from '@catalog/application/queries/list-workspace-summaries.query';
import type { WorkspaceDirectoryPort } from '@identity/application/ports/workspace-directory.port';
import type { Page } from '@shared-kernel/application/dto/page.dto';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ListWorkspaceSummariesHandler implements QueryHandlerPort<
  ListWorkspaceSummariesQuery,
  Page<WorkspaceSummaryDto>
> {
  constructor(
    private readonly directory: WorkspaceDirectoryPort,
    private readonly terms: PlanTermsPort,
  ) {}

  async execute(
    query: ListWorkspaceSummariesQuery,
  ): Promise<Page<WorkspaceSummaryDto>> {
    const page = await this.directory.list({
      after: query.after,
      limit: query.limit,
      since: query.since,
    });
    const pageTerms = await this.terms.ofWorkspaces(
      page.items.map((each) => each.id),
    );

    return {
      items: page.items.map((workspace, at) =>
        WorkspaceSummaryMapper.toDto(workspace, pageTerms[at]),
      ),
      next: page.next,
    };
  }
}
