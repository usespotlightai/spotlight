import { InvalidCommitShaError } from '@work/domain/exceptions/invalid-commit-sha.error';

const SHA = /^([0-9a-f]{40}|[0-9a-f]{64})$/;
const NONE = /^0+$/;

export class CommitSha {
  private constructor(readonly value: string) {}

  static of(raw: string): CommitSha {
    const sha = raw.trim().toLowerCase();

    if (!SHA.test(sha)) {
      throw new InvalidCommitShaError(raw);
    }

    return new CommitSha(sha);
  }

  get isNone(): boolean {
    return NONE.test(this.value);
  }

  equals(other: CommitSha | null | undefined): boolean {
    return other?.value === this.value;
  }
}
