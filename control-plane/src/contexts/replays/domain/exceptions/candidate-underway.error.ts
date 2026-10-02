export class CandidateUnderwayError extends Error {
  readonly violation = 'conflict' as const;

  constructor(candidateId: string) {
    super(
      `The candidate ${candidateId} is being replayed; stop its replays first`,
    );
    this.name = 'CandidateUnderwayError';
  }
}
