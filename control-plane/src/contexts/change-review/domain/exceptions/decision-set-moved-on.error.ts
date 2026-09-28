export class DecisionSetMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(
      `This decision set changed since it was read, and cannot be written over (${id})`,
    );
    this.name = 'DecisionSetMovedOnError';
  }
}
