import type { ReplayCheckId } from '@replays/domain/value-objects/replay-check-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ReplayCheckAbandonmentDue implements DomainEvent {
  readonly kind = 'replays.replay-check-abandonment-due';

  constructor(
    readonly checkId: ReplayCheckId,
    readonly workspaceId: WorkspaceId,
  ) {}
}
