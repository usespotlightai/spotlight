export class InvalidPageCursorError extends Error {
  readonly kind = 'invalid' as const;

  constructor() {
    super('Sorry, the page cursor is not valid.');
    this.name = 'InvalidPageCursorError';
  }
}
