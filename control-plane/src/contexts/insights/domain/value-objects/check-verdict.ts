export const CHECK_VERDICTS = ['passed', 'failed', 'skipped'] as const;

export type CheckVerdict = (typeof CHECK_VERDICTS)[number];

export const verdictOf = (passed: boolean | null): CheckVerdict =>
  passed === null ? 'skipped' : passed ? 'passed' : 'failed';
