export class InvalidAlertError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Station alert ${reason}.`);
    this.name = 'InvalidAlertError';
  }
}
