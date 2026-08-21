export class EmptyRecipientError extends Error {
  constructor() {
    super('A greeting recipient must not be empty');
    this.name = 'EmptyRecipientError';
  }
}
