export class CandidateIsLiveError extends Error {
  readonly violation = 'conflict' as const;

  constructor(candidateId: string) {
    super(
      `The candidate ${candidateId} is the live config Spotlight replays as a baseline; it goes with its replay set`,
    );
    this.name = 'CandidateIsLiveError';
  }
}
