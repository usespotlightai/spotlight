export class NoGitHubInstallationError extends Error {
  readonly kind = 'invalid' as const;

  constructor() {
    super(
      'Workspace is not connected to GitHub. Please connect it to access repositories.',
    );
    this.name = 'NoGitHubInstallationError';
  }
}
