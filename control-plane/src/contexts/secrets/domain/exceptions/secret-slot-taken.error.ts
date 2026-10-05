export class SecretSlotTakenError extends Error {
  readonly violation = 'conflict' as const;

  constructor(secretName: string, takenBy: string, slot: string) {
    super(
      `The ${secretName} and ${takenBy} secrets are both worn in ${slot} toward that host, and a request carries one`,
    );
    this.name = 'SecretSlotTakenError';
  }
}
