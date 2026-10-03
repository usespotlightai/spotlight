import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ReplayPairingDue implements DomainEvent {
  readonly kind = 'replay.pairing-due';

  constructor(
    readonly replayId: ReplayId,
    readonly workspaceId: WorkspaceId,
  ) {}
}
