import type {
  TracedRequester,
  TraceScope,
  TraceScopeSource,
  TraceScopesPort,
} from '@work/application/ports/trace-scopes.port';

export class TraceScopes implements TraceScopesPort {
  private readonly sources = new Map<string, TraceScopeSource>();

  register(source: TraceScopeSource): void {
    this.sources.set(source.owner, source);
  }

  async scopeOf(requester: TracedRequester): Promise<TraceScope | null> {
    return (
      (await this.sources.get(requester.owner)?.scopeOf(requester)) ?? null
    );
  }
}
