export class StackCheckNotHeldError extends Error {
  readonly violation = 'conflict' as const;

  constructor(stackId: string) {
    super(`Change stack ${stackId} is not being checked by that runner`);
    this.name = 'StackCheckNotHeldError';
  }
}
