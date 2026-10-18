export class InvalidAlertError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Station alert ${reason}.`);
    this.name = 'InvalidAlertError';
  }
}
