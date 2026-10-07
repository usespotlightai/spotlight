export class InvalidMemoryError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string, subject = 'memory') {
    super(`A ${subject} ${reason}.`);
    this.name = 'InvalidMemoryError';
  }

  static ofDraft(reason: string): InvalidMemoryError {
    return new InvalidMemoryError(reason, 'memory draft');
  }
}
