import type { PlanTerm } from '@catalog/domain/value-objects/plan-term.vo';
import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

// The workspace has the free plan again.
export class WorkspacePlanDeleted implements ConfigurationChanged {
  readonly kind = 'workspace-plan.deleted';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly previous: PlanTerm,
    readonly change: ConfigurationChange,
  ) {}
}
