export class StartingPointHoldMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(holder: string) {
    super(`What ${holder} holds changed while this was being written`);
    this.name = 'StartingPointHoldMovedOnError';
  }
}
