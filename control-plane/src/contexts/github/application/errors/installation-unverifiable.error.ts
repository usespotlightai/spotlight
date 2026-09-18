export class InstallationUnverifiableError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor() {
    super(
      'GitHub would not say whether that installation is yours. Sign in again, and if it keeps happening the sign-in is not authorised to list App installations.',
    );
    this.name = 'InstallationUnverifiableError';
  }
}
