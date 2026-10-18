export class InvalidApprovalAnswerError extends Error {
  readonly kind = 'conflict' as const;

  constructor(because: string) {
    super(because);
    this.name = 'InvalidApprovalAnswerError';
  }
}
