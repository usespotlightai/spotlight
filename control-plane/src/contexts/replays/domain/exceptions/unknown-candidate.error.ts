export class UnknownCandidateError extends Error {
  readonly violation = 'not-found' as const;

  constructor(candidateId: string) {
    super(`There is no candidate ${candidateId} for this caller`);
    this.name = 'UnknownCandidateError';
  }
}
