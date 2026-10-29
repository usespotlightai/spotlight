import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { Money } from '@replays/domain/value-objects/money.vo';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ReplayBaselineRequested implements DomainEvent {
  readonly kind = 'replay.baseline-requested';

  constructor(
    readonly replayId: ReplayId,
    readonly workspaceId: WorkspaceId,
    readonly setId: ReplaySetId,
    readonly baselineId: ReplayId,
    readonly candidateId: CandidateId,
    readonly ceiling: Money,
    readonly unpricedRate: Money | null,
    readonly repeats: number,
    readonly baselineRepeats: number,
  ) {}
}
