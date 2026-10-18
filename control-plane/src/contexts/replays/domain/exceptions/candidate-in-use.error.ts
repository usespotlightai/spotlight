export class CandidateInUseError extends Error {
  readonly kind = 'conflict' as const;

  constructor(candidateId: string) {
    super(
      `Candidate ${candidateId} is being replayed. Please stop its replays first.`,
    );
    this.name = 'CandidateInUseError';
  }
}
