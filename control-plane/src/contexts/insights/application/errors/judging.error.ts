export type JudgingErrorKind = 'request-failed' | 'unreadable';

export class JudgingError extends Error {
  constructor(
    readonly kind: JudgingErrorKind,
    reason: string,
  ) {
    super(`The run could not be judged: ${reason}`);
    this.name = 'JudgingError';
  }
}
