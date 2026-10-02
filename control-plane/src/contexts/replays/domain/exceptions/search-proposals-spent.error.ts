export class SearchProposalsSpentError extends Error {
  readonly violation = 'conflict' as const;

  constructor(readonly most: number) {
    super(
      `This search iteration has proposed its ${most} candidates, or tried to too often; end the run`,
    );
    this.name = 'SearchProposalsSpentError';
  }
}
