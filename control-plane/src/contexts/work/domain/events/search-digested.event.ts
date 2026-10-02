import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Money } from '@work/domain/value-objects/money.vo';
import type { SearchId } from '@work/domain/value-objects/search-id.vo';
import type { Tokens } from '@work/domain/value-objects/tokens.vo';

export class SearchDigested implements DomainEvent {
  readonly kind = 'search.digested';

  constructor(
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
    readonly searchId: SearchId,
    readonly ms: number | null,
    readonly steps: number,
    readonly spentCosts: readonly Money[],
    readonly unpricedCalls: number,
    readonly tokens: Tokens,
  ) {}
}
