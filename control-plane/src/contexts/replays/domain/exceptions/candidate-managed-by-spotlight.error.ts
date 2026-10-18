export class CandidateManagedBySpotlightError extends Error {
  readonly kind = 'conflict' as const;

  constructor(candidateId: string) {
    super(
      `Candidate ${candidateId} belongs to a search or a check. Spotlight removes it together with that search or check.`,
    );
    this.name = 'CandidateManagedBySpotlightError';
  }
}
