import type { WorkspaceSummaryDto } from '@catalog/application/dto/workspace-summary.dto';
import { PlanTermMapper } from '@catalog/application/mappers/plan-term.mapper';
import type { PlanTerm } from '@catalog/domain/value-objects/plan-term.vo';
import type { DirectoryWorkspace } from '@identity/application/ports/workspace-directory.port';

export const WorkspaceSummaryMapper = {
  toDto: (
    workspace: DirectoryWorkspace,
    term: PlanTerm,
  ): WorkspaceSummaryDto => ({
    id: workspace.id.value,
    slug: workspace.slug,
    name: workspace.name,
    createdAt: workspace.createdAt.toISOString(),
    memberCount: workspace.memberCount,
    term: PlanTermMapper.toDto(term),
  }),
};
