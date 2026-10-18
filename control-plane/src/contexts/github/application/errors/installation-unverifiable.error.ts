export class InstallationUnverifiableError extends Error {
  readonly kind = 'not-allowed' as const;

  constructor() {
    super(
      'GitHub could not confirm this installation is yours. Please sign in again.',
    );
    this.name = 'InstallationUnverifiableError';
  }
}
