const SHA = /^[0-9a-f]{40}$/;

export class CommitSha {
  private constructor(readonly value: string) {}

  static parsed(raw: string): CommitSha | null {
    const sha = raw.trim().toLowerCase();

    return SHA.test(sha) ? new CommitSha(sha) : null;
  }

  equals(other: CommitSha): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
