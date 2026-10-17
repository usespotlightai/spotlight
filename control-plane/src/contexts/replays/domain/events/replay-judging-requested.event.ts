import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ReplayJudgingRequested implements DomainEvent {
  readonly kind = 'replay.judging-requested';

  constructor(
    readonly replayId: ReplayId,
    readonly workspaceId: WorkspaceId,
    readonly candidateId: CandidateId,
    readonly run: RunId,
    readonly original: RunId,
  ) {}
}
