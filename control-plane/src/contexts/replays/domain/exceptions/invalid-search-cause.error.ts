export class InvalidSearchCauseError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    readonly field: 'cause' | 'evidence' | 'suggestion',
    readonly reason: string,
  ) {
    super(`A cause’s ${field} ${reason}`);
    this.name = 'InvalidSearchCauseError';
  }
}
