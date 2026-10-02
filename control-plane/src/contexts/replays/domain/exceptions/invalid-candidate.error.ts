export class InvalidCandidateError extends Error {
  readonly violation = 'invalid' as const;

  constructor(readonly reason: string) {
    super(`A candidate ${reason}`);
    this.name = 'InvalidCandidateError';
  }
}
