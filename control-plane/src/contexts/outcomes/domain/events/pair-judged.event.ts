import type { PairReading } from '@outcomes/domain/aggregates/pair-judging.aggregate';
import type { PairWinner } from '@outcomes/domain/value-objects/pair-order';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { ModelUsage } from '@shared-kernel/domain/value-objects/model-usage.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class PairJudged implements DomainEvent {
  readonly kind = 'pair-judging.judged';

  constructor(
    readonly runId: RunId,
    readonly against: RunId,
    readonly workspaceId: WorkspaceId,
    readonly winner: PairWinner,
    readonly model: string,
    readonly readings: readonly PairReading[],
    readonly spent: ModelUsage,
    readonly at: Date,
  ) {}
}
