import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type { CohortKind } from '@change-review/domain/value-objects/stack-cohort.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ReadyCohort {
  readonly kind: CohortKind;
  readonly title: string;
  readonly intent: string;
}

export class ChangeStackReady implements DomainEvent {
  readonly kind = 'change-stack.ready';

  constructor(
    readonly stackId: ChangeStackId,
    readonly runId: RunId,
    readonly taskId: TaskId | null,
    readonly workspaceId: WorkspaceId,
    readonly cohorts: readonly ReadyCohort[],
    readonly at: Date,
  ) {}
}
