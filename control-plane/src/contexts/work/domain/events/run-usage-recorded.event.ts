import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Money } from '@work/domain/value-objects/money.vo';
import type { RunRequester } from '@work/domain/value-objects/run-requester.vo';
import type { Tokens } from '@work/domain/value-objects/tokens.vo';
import type { ToolUse } from '@work/domain/value-objects/tool-use.vo';

export class RunUsageRecorded implements DomainEvent {
  readonly kind = 'run.usage-recorded';

  constructor(
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
    readonly requester: RunRequester,
    readonly listed: boolean,
    readonly attempt: number,
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
