export class InstallationAlreadyConnectedError extends Error {
  readonly kind = 'conflict' as const;

  constructor(installation: string) {
    super(
      `GitHub installation ${installation} is connected to another workspace. Please disconnect it there first.`,
    );
    this.name = 'InstallationAlreadyConnectedError';
  }
}
