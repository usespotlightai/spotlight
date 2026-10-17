export class SetupNeedsEgressError extends Error {
  readonly violation = 'invalid' as const;

  constructor() {
    super(
      'A setup chat needs egress. No host serves this workspace, and no push pool names an egress. Please connect a host, or name an egress in a push pool.',
    );
    this.name = 'SetupNeedsEgressError';
  }
}
