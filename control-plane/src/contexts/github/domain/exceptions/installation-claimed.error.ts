export class InstallationClaimedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(installation: string) {
    super(
      `GitHub installation ${installation} is connected to another workspace. Please disconnect it there first.`,
    );
    this.name = 'InstallationClaimedError';
  }
}
