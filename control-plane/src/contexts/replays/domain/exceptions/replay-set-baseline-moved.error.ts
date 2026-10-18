export class ReplaySetBaselineMovedError extends Error {
  readonly kind = 'conflict' as const;

  constructor(setId: string) {
    super(
      `The baseline of replay set ${setId} changed while the replay was starting. Please start it again.`,
    );
    this.name = 'ReplaySetBaselineMovedError';
  }
}
