export class SetupNeedsAHostError extends Error {
  readonly violation = 'invalid' as const;

  constructor() {
    super(
      'A setup chat runs only on a host, and no host serves this workspace. Please connect a host first.',
    );
    this.name = 'SetupNeedsAHostError';
  }
}
