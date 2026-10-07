export class CandidateKeptBySpotlightError extends Error {
  readonly violation = 'conflict' as const;

  constructor(candidateId: string) {
    super(
      `Candidate ${candidateId} belongs to a search or change check. It is removed with them.`,
    );
    this.name = 'CandidateKeptBySpotlightError';
  }
}
