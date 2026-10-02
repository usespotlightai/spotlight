import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Money } from '@work/domain/value-objects/money.vo';
import type { Tokens } from '@work/domain/value-objects/tokens.vo';

export class ReplayDigested implements DomainEvent {
  readonly kind = 'replay.digested';

  constructor(
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
    readonly replayOf: RunId,
    readonly ms: number | null,
    readonly steps: number,
    readonly changedLines: number | null,
    readonly cost: Money | null,
    readonly tokens: Tokens,
  ) {}
}
