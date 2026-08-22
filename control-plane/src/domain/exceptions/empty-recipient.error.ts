export class EmptyRecipientError extends Error {
  readonly violation = 'invalid' as const;

  constructor() {
    super('A greeting recipient must not be empty');
    this.name = 'EmptyRecipientError';
  }
}
