export class InvalidBranchError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Branch ${reason}.`);
    this.name = 'InvalidBranchError';
  }
}
