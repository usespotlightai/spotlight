export class InvalidScoreError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string, subject = 'score') {
    super(`A ${subject} ${reason}`);
    this.name = 'InvalidScoreError';
  }

  static ofJudging(reason: string): InvalidScoreError {
    return new InvalidScoreError(reason, 'judging');
  }
}
