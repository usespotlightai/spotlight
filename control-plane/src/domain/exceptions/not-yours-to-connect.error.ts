/** The reason is the only thing the person on the other end can act on. */
export class NotYoursToConnectError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(message: string) {
    super(message);
    this.name = 'NotYoursToConnectError';
  }
}
