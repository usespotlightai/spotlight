export class InvalidCallbackNoteError extends Error {
  readonly kind = 'invalid' as const;

  constructor(longest: number) {
    super(`Note must not be empty. Maximum length: ${longest} characters`);
    this.name = 'InvalidCallbackNoteError';
  }
}
