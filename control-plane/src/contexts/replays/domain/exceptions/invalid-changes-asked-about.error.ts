export class InvalidChangesAskedAboutError extends Error {
  readonly violation = 'invalid' as const;

  constructor(readonly reason: string) {
    super(reason);
    this.name = 'InvalidChangesAskedAboutError';
  }
}
