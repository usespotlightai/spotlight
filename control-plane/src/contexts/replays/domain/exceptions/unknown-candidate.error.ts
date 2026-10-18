export class UnknownCandidateError extends Error {
  readonly kind = 'not-found' as const;

  constructor(candidateId: string) {
    super(`Candidate ${candidateId} not found.`);
    this.name = 'UnknownCandidateError';
  }
}
