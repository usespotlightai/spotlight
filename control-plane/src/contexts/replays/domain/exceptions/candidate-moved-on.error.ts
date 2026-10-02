export class CandidateMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(candidateId: string) {
    super(`The candidate ${candidateId} changed while this was being written`);
    this.name = 'CandidateMovedOnError';
  }
}
