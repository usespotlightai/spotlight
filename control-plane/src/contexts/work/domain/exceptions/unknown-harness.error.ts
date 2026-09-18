export class UnknownHarnessError extends Error {
  readonly violation = 'invalid' as const;

  constructor(id: string) {
    super(`No harness called "${id}" is known`);
    this.name = 'UnknownHarnessError';
  }
}
