import type { Branch } from '@work/domain/value-objects/branch.vo';

export class RequestedBase {
  private constructor(
    readonly branch: Branch,
    readonly defaultBranches: readonly Branch[],
  ) {}

  static of(branch: Branch, defaultBranches: readonly Branch[]): RequestedBase {
    return new RequestedBase(branch, defaultBranches);
  }

  get taskBase(): Branch | null {
    const isEveryDefault =
      this.defaultBranches.length > 0 &&
      this.defaultBranches.every((each) => each.equals(this.branch));

    return isEveryDefault ? null : this.branch;
  }
}
