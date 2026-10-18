export class SearchCandidateNameTakenError extends Error {
  readonly kind = 'conflict' as const;

  constructor(readonly candidateName: string) {
    super(
      `This search has a candidate named ${candidateName} already; name it otherwise`,
    );
    this.name = 'SearchCandidateNameTakenError';
  }
}
