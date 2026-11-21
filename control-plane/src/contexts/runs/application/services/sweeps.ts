interface Kept<Cursor> {
  readonly from: Cursor;
  readonly page: number;
}

// For one kind of waiting work: where the page past the head starts in each workspace. The head is page 1. Each tick reads the head and one page past it, so every item that waits in the first maxPages pages when a sweep starts is read within maxPages - 1 ticks. An item that waits again behind the cursor, as when its back-off ends, is read in the next sweep.
export class Sweeps<Cursor> {
  readonly #kept = new Map<string, Kept<Cursor>>();

  constructor(private readonly maxPages: number) {}

  // The page past the head to read in the workspace: where it starts, and its number.
  next(workspace: string, headEnd: Cursor): Kept<Cursor> {
    return this.#kept.get(workspace) ?? { from: headEnd, page: 2 };
  }

  // Keeps where the page after the read page starts. The sweep starts again at the head after a page that is not full, or after the last page.
  read(
    workspace: string,
    page: number,
    after: { readonly full: boolean; readonly next: Cursor | null },
  ): void {
    if (!after.full || after.next === null || page >= this.maxPages) {
      this.#kept.delete(workspace);
      return;
    }

    this.#kept.set(workspace, { from: after.next, page: page + 1 });
  }

  restart(workspace: string): void {
    this.#kept.delete(workspace);
  }

  // Forgets the workspaces with no waiting work.
  keepOnly(workspaces: ReadonlySet<string>): void {
    for (const workspace of this.#kept.keys()) {
      if (!workspaces.has(workspace)) {
        this.#kept.delete(workspace);
      }
    }
  }
}
