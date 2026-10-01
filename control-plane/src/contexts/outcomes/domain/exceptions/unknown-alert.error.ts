export class UnknownAlertError extends Error {
  readonly violation = 'not-found' as const;

  constructor(alertId: string) {
    super(`There is no alert ${alertId} for this caller`);
    this.name = 'UnknownAlertError';
  }
}
