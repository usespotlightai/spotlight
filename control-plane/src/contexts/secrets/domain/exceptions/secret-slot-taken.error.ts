export class SecretSlotTakenError extends Error {
  readonly violation = 'conflict' as const;

  constructor(secretName: string, takenBy: string, slot: string) {
    super(
      `Secrets ${secretName} and ${takenBy} are both worn in ${slot} toward the same host. A request can carry only one of them.`,
    );
    this.name = 'SecretSlotTakenError';
  }
}
