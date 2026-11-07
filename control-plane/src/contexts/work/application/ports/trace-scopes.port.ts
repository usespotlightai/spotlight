import type { RunRequesterContract } from '@runs/application/contracts/run-order.contract';

export const TRACE_SCOPES = Symbol('TRACE_SCOPES');

export interface TraceScope {
  readonly stationId: string;
  readonly hiddenTaskIds: readonly string[];
  readonly shownRunIds: readonly string[];
}

export interface TraceScopeSource {
  readonly owner: string;

  scopeOf(requester: RunRequesterContract): Promise<TraceScope | null>;
}

export interface TraceScopesPort {
  register(source: TraceScopeSource): void;
}
