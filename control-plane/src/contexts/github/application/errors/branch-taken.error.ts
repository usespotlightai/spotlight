export class BranchTakenError extends Error {
  readonly kind = 'conflict' as const;

  constructor(branch: string) {
    super(
      `Branch ${branch} has commits not written by Spotlight. Spotlight leaves it unchanged.`,
    );
    this.name = 'BranchTakenError';
  }
}
