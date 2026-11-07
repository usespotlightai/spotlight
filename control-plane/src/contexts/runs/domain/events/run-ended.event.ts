import type { Handover } from '@runs/domain/value-objects/handover.vo';
import type { HarnessSession } from '@runs/domain/value-objects/harness-session.vo';
import type { RunAttempt } from '@runs/domain/value-objects/run-attempt.vo';
import type {
  RunEnding,
  RunOutcome,
} from '@runs/domain/value-objects/run-outcome.vo';
import type { RunRequester } from '@runs/domain/value-objects/run-requester.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RunEnded implements DomainEvent {
  readonly kind = 'run.ended';

  constructor(
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
    readonly requester: RunRequester,
    readonly outcome: RunOutcome,
    readonly claimedBy: RunnerId | null,
    readonly handover: Handover | null,
    readonly session: HarnessSession | null,
    readonly attempt: RunAttempt,
    readonly asked: boolean,
    readonly started: boolean,
    readonly reported: boolean,
    readonly endedAt: Date,
  ) {}

  get ending(): RunEnding {
    return this.outcome.ending;
  }
}
