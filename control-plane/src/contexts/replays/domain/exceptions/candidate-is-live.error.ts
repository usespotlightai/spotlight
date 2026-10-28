export class CandidateIsLiveError extends Error {
  readonly kind = 'conflict' as const;

  constructor(candidateId: string) {
    super(
      `Candidate ${candidateId} is a snapshot of the live config. Spotlight removes it with its replays.`,
    );
    this.name = 'CandidateIsLiveError';
  }
}
