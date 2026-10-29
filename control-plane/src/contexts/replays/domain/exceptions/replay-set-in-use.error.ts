export class ReplaySetInUseError extends Error {
  readonly kind = 'conflict' as const;

  constructor(setId: string) {
    super(
      `Replay set ${setId} is in use by a replay, a search or a check that waits for its baseline. Please try again after they end.`,
    );
    this.name = 'ReplaySetInUseError';
  }
}
