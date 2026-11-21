import type { WorkspaceSummaryDto } from '@identity/application/dto/workspace-summary.dto';
import { WorkspaceSummaryMapper } from '@identity/application/mappers/workspace-summary.mapper';
import type { WorkspaceDirectoryPort } from '@identity/application/ports/workspace-directory.port';
import type { ListWorkspaceSummariesQuery } from '@identity/application/queries/list-workspace-summaries.query';
import type { Page } from '@shared-kernel/application/dto/page.dto';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ListWorkspaceSummariesHandler implements QueryHandlerPort<
  ListWorkspaceSummariesQuery,
  Page<WorkspaceSummaryDto>
> {
  constructor(private readonly directory: WorkspaceDirectoryPort) {}

  async execute(
    query: ListWorkspaceSummariesQuery,
  ): Promise<Page<WorkspaceSummaryDto>> {
    const page = await this.directory.list({
      after: query.after,
      limit: query.limit,
      since: query.since,
    });

    return {
      items: page.items.map((each) => WorkspaceSummaryMapper.toDto(each)),
      next: page.next,
    };
  }
}
