import type { PairVerdict } from '@replays/domain/value-objects/entry-pairing.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class SideBySideJudged implements DomainEvent {
  readonly kind = 'side-by-side-judging.judged';

  constructor(
    readonly runId: RunId,
    readonly otherRunId: RunId,
    readonly workspaceId: WorkspaceId,
    readonly verdict: PairVerdict,
    readonly at: Date,
  ) {}
}
