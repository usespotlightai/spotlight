export class CandidateVersionConflictError extends Error {
  readonly violation = 'conflict' as const;

  constructor(candidateId: string) {
    super(
      `Candidate ${candidateId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'CandidateVersionConflictError';
  }
}
