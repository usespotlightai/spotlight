export class CredentialUnopenableError extends Error {
  constructor(readonly label: string) {
    super(`Credential ${label} does not open with this deployment's keys.`);
    this.name = 'CredentialUnopenableError';
  }
}
