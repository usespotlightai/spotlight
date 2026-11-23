import type { BranchPushRefusal } from '@work/domain/value-objects/branch-push-refusal';
import { Branch } from '@work/domain/value-objects/branch.vo';
import { CommitSha } from '@work/domain/value-objects/commit-sha.vo';

const HEADS = 'refs/heads/';

export class RefUpdate {
  private constructor(
    readonly ref: string,
    readonly from: CommitSha,
    readonly to: CommitSha,
    readonly rewrites: boolean,
  ) {}

  static of(input: {
    ref: string;
    from: string;
    to: string;
    rewrites?: boolean;
  }): RefUpdate {
    return new RefUpdate(
      input.ref,
      CommitSha.of(input.from),
      CommitSha.of(input.to),
      input.rewrites ?? true,
    );
  }

  get deletes(): boolean {
    return this.to.isNone;
  }

  get creates(): boolean {
    return this.from.isNone;
  }

  get target(): Branch | BranchPushRefusal {
    const branch = this.branch;

    if (!branch) {
      return { kind: 'push-not-to-a-branch', ref: this.ref };
    }

    return this.deletes ? { kind: 'push-deletes-a-branch', branch } : branch;
  }

  get branch(): Branch | null {
    return this.ref.startsWith(HEADS) && this.ref.length > HEADS.length
      ? Branch.of(this.ref.slice(HEADS.length))
      : null;
  }
}
