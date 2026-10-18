const SUBJECTS = {
  score: 'Score',
  judging: 'Judging',
  reason: 'Judge reason',
} as const;

export class InvalidScoreError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string, subject: keyof typeof SUBJECTS = 'score') {
    super(`${SUBJECTS[subject]} ${reason}.`);
    this.name = 'InvalidScoreError';
  }

  static ofJudging(reason: string): InvalidScoreError {
    return new InvalidScoreError(reason, 'judging');
  }
}
