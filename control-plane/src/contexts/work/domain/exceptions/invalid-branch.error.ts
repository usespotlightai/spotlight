export class InvalidBranchError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A branch ${reason}`);
    this.name = 'InvalidBranchError';
  }
}
