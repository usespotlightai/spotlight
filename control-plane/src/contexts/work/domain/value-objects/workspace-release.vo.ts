export class WorkspaceRelease {
  private constructor(readonly releasedAt: Date | null) {}

  static held(): WorkspaceRelease {
    return new WorkspaceRelease(null);
  }

  static since(at: Date): WorkspaceRelease {
    return new WorkspaceRelease(at);
  }

  get released(): boolean {
    return this.releasedAt !== null;
  }

  equals(other: WorkspaceRelease): boolean {
    return (
      (this.releasedAt?.getTime() ?? null) ===
      (other.releasedAt?.getTime() ?? null)
    );
  }
}
