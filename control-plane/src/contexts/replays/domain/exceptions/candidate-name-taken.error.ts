export class CandidateNameTakenError extends Error {
  readonly violation = 'conflict' as const;

  constructor(readonly address: string) {
    super(`There is already a candidate at ${address}`);
    this.name = 'CandidateNameTakenError';
  }
}
