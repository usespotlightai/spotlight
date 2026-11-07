import type { RunRequester } from '@runs/domain/value-objects/run-requester.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunFailureCode } from '@shared-kernel/domain/value-objects/run-failure-code';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RunExhausted implements DomainEvent {
  readonly kind = 'run.exhausted';

  constructor(
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
    readonly requester: RunRequester,
    readonly attempt: number,
    readonly expiredLeases: number,
    readonly asked: boolean,
    readonly failure: RunFailureCode | null,
    readonly started: boolean,
    readonly endedAt: Date,
  ) {}
}
