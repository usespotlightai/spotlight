import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ReplayCeilingReached implements DomainEvent {
  readonly kind = 'replay.ceiling-reached';

  constructor(
    readonly replayId: ReplayId,
    readonly workspaceId: WorkspaceId,
    readonly runs: readonly RunId[],
  ) {}
}
