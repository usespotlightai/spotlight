export class LearnedOutputMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(tool: string) {
    super(`What ${tool} answers was learned by another call meanwhile`);
    this.name = 'LearnedOutputMovedOnError';
  }
}
