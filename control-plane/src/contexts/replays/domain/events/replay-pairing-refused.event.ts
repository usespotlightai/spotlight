import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ReplayPairingRefused implements DomainEvent {
  readonly kind = 'replay.pairing-refused';

  constructor(
    readonly replayId: ReplayId,
    readonly workspaceId: WorkspaceId,
    readonly run: RunId,
    readonly against: RunId,
    readonly why: string,
  ) {}
}
