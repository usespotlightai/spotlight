import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { RunSubject } from '@work/domain/value-objects/run-subject.vo';

export class RunResumed implements DomainEvent {
  readonly kind = 'run.resumed';

  constructor(
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
    readonly subject: RunSubject | null,
    readonly attempt: number,
  ) {}
}
