export class InvalidVoiceError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A voice ${reason}`);
    this.name = 'InvalidVoiceError';
  }
}
