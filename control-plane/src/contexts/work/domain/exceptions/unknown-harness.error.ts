export class UnknownHarnessError extends Error {
  readonly kind = 'invalid' as const;

  constructor(id: string) {
    super(`Harness ${id} not found.`);
    this.name = 'UnknownHarnessError';
  }
}
