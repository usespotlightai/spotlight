import type { WorkspaceSummaryDto } from '@identity/application/dto/workspace-summary.dto';
import type { DirectoryWorkspace } from '@identity/application/ports/workspace-directory.port';

export const WorkspaceSummaryMapper = {
  toDto: (workspace: DirectoryWorkspace): WorkspaceSummaryDto => ({
    id: workspace.id.value,
    slug: workspace.slug,
    name: workspace.name,
    createdAt: workspace.createdAt.toISOString(),
    memberCount: workspace.memberCount,
  }),
};
