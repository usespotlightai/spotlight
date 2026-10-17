export class StackCheckNotLeasedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(stackId: string) {
    super(`Change stack ${stackId} is not being checked by this runner.`);
    this.name = 'StackCheckNotLeasedError';
  }
}
