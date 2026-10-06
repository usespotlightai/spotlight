export class NoGitHubInstallationError extends Error {
  readonly violation = 'invalid' as const;

  constructor() {
    super(
      'Workspace is not connected to GitHub. Please connect it to reach repositories.',
    );
    this.name = 'NoGitHubInstallationError';
  }
}
