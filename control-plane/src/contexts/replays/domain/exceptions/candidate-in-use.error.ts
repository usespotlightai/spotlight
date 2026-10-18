export class CandidateInUseError extends Error {
  readonly violation = 'conflict' as const;

  constructor(candidateId: string) {
    super(
      `Candidate ${candidateId} is being replayed. Please stop its replays first.`,
    );
    this.name = 'CandidateInUseError';
  }
}
