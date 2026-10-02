export class BranchTakenError extends Error {
  readonly violation = 'conflict' as const;

  constructor(branch: string) {
    super(
      `The branch ${branch} holds commits Spotlight did not write; Spotlight leaves it alone`,
    );
    this.name = 'BranchTakenError';
  }
}
