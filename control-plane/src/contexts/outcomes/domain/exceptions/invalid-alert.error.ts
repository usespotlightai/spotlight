export class InvalidAlertError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A station alert ${reason}`);
    this.name = 'InvalidAlertError';
  }
}
