export class InvalidCandidateError extends Error {
  readonly kind = 'invalid' as const;

  constructor(readonly reason: string) {
    super(`Candidate ${reason}.`);
    this.name = 'InvalidCandidateError';
  }
}
