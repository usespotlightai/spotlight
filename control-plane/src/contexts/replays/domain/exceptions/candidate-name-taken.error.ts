export class CandidateNameTakenError extends Error {
  readonly kind = 'conflict' as const;

  constructor(readonly address: string) {
    super(
      `A candidate named ${address} already exists. Please choose another name.`,
    );
    this.name = 'CandidateNameTakenError';
  }
}
