import type { PairPass } from '@insights/domain/aggregates/side-by-side-judging.aggregate';
import type { PairWinner } from '@insights/domain/value-objects/pair-order';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { ModelUsage } from '@shared-kernel/domain/value-objects/model-usage.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class SideBySideJudged implements DomainEvent {
  readonly kind = 'side-by-side-judging.judged';

  constructor(
    readonly runId: RunId,
    readonly otherRunId: RunId,
    readonly workspaceId: WorkspaceId,
    readonly winner: PairWinner,
    readonly model: string,
    readonly passes: readonly PairPass[],
    readonly spent: ModelUsage,
    readonly at: Date,
  ) {}
}
