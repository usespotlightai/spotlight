export class ReplaySetBaselineMovedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(setId: string) {
    super(
      `The baseline of replay set ${setId} changed while the replay was starting; start it again`,
    );
    this.name = 'ReplaySetBaselineMovedError';
  }
}
