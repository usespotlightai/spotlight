export class CandidateUnpickableError extends Error {
  readonly violation = 'conflict' as const;

  constructor(reason: string) {
    super(reason);
    this.name = 'CandidateUnpickableError';
  }
}
