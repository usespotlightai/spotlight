export class SearchProposalsExhaustedError extends Error {
  readonly kind = 'conflict' as const;

  constructor(readonly max: number) {
    super(
      `This search iteration has proposed its ${max} candidates, or tried to too often; end the run`,
    );
    this.name = 'SearchProposalsExhaustedError';
  }
}
