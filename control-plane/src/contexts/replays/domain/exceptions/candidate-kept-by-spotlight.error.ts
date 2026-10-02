export class CandidateKeptBySpotlightError extends Error {
  readonly violation = 'conflict' as const;

  constructor(candidateId: string) {
    super(
      `The candidate ${candidateId} was made by Spotlight for a search or a change check; it goes with them`,
    );
    this.name = 'CandidateKeptBySpotlightError';
  }
}
