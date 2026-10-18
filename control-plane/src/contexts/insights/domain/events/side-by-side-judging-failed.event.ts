import type { JudgingFailure } from '@insights/domain/value-objects/judging-failure.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { ModelUsage } from '@shared-kernel/domain/value-objects/model-usage.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class SideBySideJudgingFailed implements DomainEvent {
  readonly kind = 'side-by-side-judging.failed';

  constructor(
    readonly runId: RunId,
    readonly otherRunId: RunId,
    readonly workspaceId: WorkspaceId,
    readonly failure: JudgingFailure,
    readonly spent: ModelUsage,
  ) {}
}
