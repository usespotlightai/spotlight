export class CandidateIsLiveError extends Error {
  readonly violation = 'conflict' as const;

  constructor(candidateId: string) {
    super(
      `Candidate ${candidateId} is the baseline of the live config. Deleting its replay set removes it.`,
    );
    this.name = 'CandidateIsLiveError';
  }
}
