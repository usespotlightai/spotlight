import type { Money } from '@runs/domain/value-objects/money.vo';
import type { RunAttempt } from '@runs/domain/value-objects/run-attempt.vo';
import type { RunRequester } from '@runs/domain/value-objects/run-requester.vo';
import type { Tokens } from '@runs/domain/value-objects/tokens.vo';
import type { ToolUse } from '@runs/domain/value-objects/tool-use.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RunUsageRecorded implements DomainEvent {
  readonly kind = 'run.usage-recorded';

  constructor(
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
    readonly requester: RunRequester,
    readonly listed: boolean,
    readonly attempt: RunAttempt,
    readonly ms: number | null,
    readonly steps: number,
    readonly errors: number,
    readonly changedLines: number,
    readonly contextTokens: number | null,
    readonly contextWindow: number | null,
    readonly cost: Money | null,
    readonly spentCosts: readonly Money[],
    readonly unpricedCalls: number,
    readonly tokens: Tokens,
    readonly tools: ToolUse,
  ) {}
}
