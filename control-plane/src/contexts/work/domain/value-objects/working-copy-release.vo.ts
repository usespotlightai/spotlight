export class WorkingCopyRelease {
  private constructor(readonly releasedAt: Date | null) {}

  static held(): WorkingCopyRelease {
    return new WorkingCopyRelease(null);
  }

  static since(at: Date): WorkingCopyRelease {
    return new WorkingCopyRelease(at);
  }

  get released(): boolean {
    return this.releasedAt !== null;
  }

  equals(other: WorkingCopyRelease): boolean {
    return (
      (this.releasedAt?.getTime() ?? null) ===
      (other.releasedAt?.getTime() ?? null)
    );
  }
}
