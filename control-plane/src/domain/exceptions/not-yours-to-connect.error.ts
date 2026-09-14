export class NotYoursToConnectError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(message: string) {
    super(message);
    this.name = 'NotYoursToConnectError';
  }
}
