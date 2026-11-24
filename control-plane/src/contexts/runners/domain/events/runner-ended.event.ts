import type { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import type { RunnerEnding } from '@runners/domain/value-objects/runner-ending';
import type { RunnerWork } from '@runners/domain/value-objects/runner-work.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

// A runner ended, or Spotlight released it before it claimed work. A runner that claimed no work has no work and no claim time.
export class RunnerEnded implements DomainEvent {
  readonly kind = 'runner.ended';

  constructor(
    readonly runnerId: RunnerId,
    readonly workspaceId: WorkspaceId,
    readonly source: CredentialSource,
    readonly platform: boolean,
    readonly work: RunnerWork | null,
    readonly startedAt: Date,
    readonly claimedAt: Date | null,
    readonly endedAt: Date,
    readonly ending: RunnerEnding,
  ) {}
}
