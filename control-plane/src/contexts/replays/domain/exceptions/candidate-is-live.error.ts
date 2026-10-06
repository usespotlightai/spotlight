export class CandidateIsLiveError extends Error {
  readonly violation = 'conflict' as const;

  constructor(candidateId: string) {
    super(
      `Candidate ${candidateId} is the live config baseline. It is removed with its replay set.`,
    );
    this.name = 'CandidateIsLiveError';
  }
}
