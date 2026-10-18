export class UnknownAlertError extends Error {
  readonly kind = 'not-found' as const;

  constructor(alertId: string) {
    super(`Alert ${alertId} not found.`);
    this.name = 'UnknownAlertError';
  }
}
