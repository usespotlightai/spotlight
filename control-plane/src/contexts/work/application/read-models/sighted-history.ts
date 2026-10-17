import type { SearchSight } from '@work/application/ports/search-sight.port';

export class SightedHistory {
  private constructor(private readonly sight: SearchSight | null) {}

  static unsighted(): SightedHistory {
    return new SightedHistory(null);
  }

  static through(sight: SearchSight): SightedHistory {
    return new SightedHistory(sight);
  }

  get isSearch(): boolean {
    return this.sight !== null;
  }

  seesRunAt(stationId: string | null): boolean {
    return !this.sight || stationId === this.sight.stationId;
  }

  hides(run: { readonly taskId: string }): boolean {
    return this.sight?.hiddenTasks.includes(run.taskId) ?? false;
  }

  get hiddenTasks(): readonly string[] {
    return this.sight?.hiddenTasks ?? [];
  }

  shownBeyond(
    listed: readonly { readonly runId: string }[],
  ): readonly string[] {
    return (this.sight?.shownOriginals ?? []).filter(
      (runId) => !listed.some((each) => each.runId === runId),
    );
  }

  get candidates(): SearchSight['candidates'] {
    return this.sight?.candidates ?? [];
  }

  get seedBlock(): SearchSight['seedBlock'] | null {
    return this.sight?.seedBlock ?? null;
  }
}
