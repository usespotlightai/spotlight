export class LearnedOutputMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(tool: string) {
    super(
      `Another call learned what ${tool} answers at the same time. Please try again.`,
    );
    this.name = 'LearnedOutputMovedOnError';
  }
}
