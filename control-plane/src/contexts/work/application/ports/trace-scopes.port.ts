export const TRACE_SCOPES = Symbol('TRACE_SCOPES');

export interface TracedRequester {
  readonly owner: string;
  readonly kind: string;
  readonly id: string;
  readonly token: string | null;
}

export interface TraceScope {
  readonly stationId: string;
  readonly hiddenTaskIds: readonly string[];
  readonly shownRunIds: readonly string[];
}

export interface TraceScopeSource {
  readonly owner: string;

  scopeOf(requester: TracedRequester): Promise<TraceScope | null>;
}

export interface TraceScopesPort {
  register(source: TraceScopeSource): void;
}
