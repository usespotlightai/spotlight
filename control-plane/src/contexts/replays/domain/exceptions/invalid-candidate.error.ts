export class InvalidCandidateError extends Error {
  readonly violation = 'invalid' as const;

  constructor(readonly reason: string) {
    super(`Candidate ${reason}.`);
    this.name = 'InvalidCandidateError';
  }
}
