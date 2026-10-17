export class ReplayVersionConflictError extends Error {
  readonly violation = 'conflict' as const;

  constructor(replayId: string) {
    super(
      `Replay ${replayId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'ReplayVersionConflictError';
  }
}
