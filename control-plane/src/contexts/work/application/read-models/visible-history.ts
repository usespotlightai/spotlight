import type { SearchVisibility } from '@work/application/ports/search-visibility.port';

export class VisibleHistory {
  private constructor(private readonly visibility: SearchVisibility | null) {}

  static unrestricted(): VisibleHistory {
    return new VisibleHistory(null);
  }

  static limitedTo(visibility: SearchVisibility): VisibleHistory {
    return new VisibleHistory(visibility);
  }

  get isSearch(): boolean {
    return this.visibility !== null;
  }

  seesRunAt(stationId: string | null): boolean {
    return !this.visibility || stationId === this.visibility.stationId;
  }

  hides(run: { readonly taskId: string }): boolean {
    return this.visibility?.heldOutTasks.includes(run.taskId) ?? false;
  }

  get heldOutTasks(): readonly string[] {
    return this.visibility?.heldOutTasks ?? [];
  }

  shownBeyond(
    listed: readonly { readonly runId: string }[],
  ): readonly string[] {
    return (this.visibility?.shownOriginals ?? []).filter(
      (runId) => !listed.some((each) => each.runId === runId),
    );
  }

  get candidates(): SearchVisibility['candidates'] {
    return this.visibility?.candidates ?? [];
  }

  get seedBlock(): SearchVisibility['seedBlock'] | null {
    return this.visibility?.seedBlock ?? null;
  }
}
