export class InvalidApprovalAnswerError extends Error {
  readonly violation = 'conflict' as const;

  constructor(because: string) {
    super(because);
    this.name = 'InvalidApprovalAnswerError';
  }
}
