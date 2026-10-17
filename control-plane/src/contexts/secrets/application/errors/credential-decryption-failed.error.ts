export class CredentialDecryptionFailedError extends Error {
  constructor(readonly label: string) {
    super(
      `Credential ${label} does not decrypt with the keys of this deployment.`,
    );
    this.name = 'CredentialDecryptionFailedError';
  }
}
