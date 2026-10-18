export class InvalidBranchError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Branch ${reason}.`);
    this.name = 'InvalidBranchError';
  }
}
