export type JudgingTrouble = 'refused' | 'unreadable';

export class JudgingError extends Error {
  constructor(
    readonly trouble: JudgingTrouble,
    reason: string,
  ) {
    super(`The run could not be judged: ${reason}`);
    this.name = 'JudgingError';
  }
}
