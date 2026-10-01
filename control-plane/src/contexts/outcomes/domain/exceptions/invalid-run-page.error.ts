export class InvalidRunPageError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Runs are paged ${reason}`);
    this.name = 'InvalidRunPageError';
  }
}
