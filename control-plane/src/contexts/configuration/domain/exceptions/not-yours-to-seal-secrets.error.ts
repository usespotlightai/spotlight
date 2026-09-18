export class NotYoursToSealSecretsError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor() {
    super(
      'Only an owner or an admin may add an integration that needs secrets',
    );
    this.name = 'NotYoursToSealSecretsError';
  }
}
