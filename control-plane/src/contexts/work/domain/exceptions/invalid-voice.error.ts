export class InvalidVoiceError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Voice ${reason}.`);
    this.name = 'InvalidVoiceError';
  }
}
