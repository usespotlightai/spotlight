import type {
  PlanTermDto,
  WorkspaceSummaryDto,
} from '@catalog/application/dto/workspace-summary.dto';
import type { WorkspaceListing } from '@catalog/application/ports/workspaces.port';
import type { PlanTerm } from '@catalog/domain/value-objects/plan-term.vo';

export const WorkspaceSummaryMapper = {
  toPlanTerm: (term: PlanTerm): PlanTermDto => ({
    plan: term.plan.value,
    expiresAt: term.expiresAt?.toISOString() ?? null,
  }),

  toSummary: (
    workspace: WorkspaceListing,
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
