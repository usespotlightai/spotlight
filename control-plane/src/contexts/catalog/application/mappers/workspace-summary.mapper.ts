import type { WorkspaceSummaryDto } from '@catalog/application/dto/workspace-summary.dto';
import type { DirectoryWorkspace } from '@catalog/application/ports/workspace-directory.port';
import type { PlanTerm } from '@catalog/domain/value-objects/plan-term.vo';

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
    plan: term.plan.value,
    planExpiresAt: term.expiresAt?.toISOString() ?? null,
  }),
};
