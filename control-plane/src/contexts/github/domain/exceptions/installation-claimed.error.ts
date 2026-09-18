export class InstallationClaimedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(installation: string) {
    super(
      `GitHub installation ${installation} is already connected to another workspace. Disconnect it there first`,
    );
    this.name = 'InstallationClaimedError';
  }
}
