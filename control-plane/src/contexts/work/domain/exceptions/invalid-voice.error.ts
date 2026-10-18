export class InvalidVoiceError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Voice ${reason}.`);
    this.name = 'InvalidVoiceError';
  }
}
