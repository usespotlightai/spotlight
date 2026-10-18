export class StackCheckNotLeasedError extends Error {
  readonly kind = 'conflict' as const;

  constructor(stackId: string) {
    super(`Change stack ${stackId} is not being checked by this runner.`);
    this.name = 'StackCheckNotLeasedError';
  }
}
