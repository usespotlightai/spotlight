export class ReplaySetUnderwayError extends Error {
  readonly violation = 'conflict' as const;

  constructor(setId: string) {
    super(
      `Replay set ${setId} is being replayed or searched. Please stop its replays and searches first.`,
    );
    this.name = 'ReplaySetUnderwayError';
  }
}
