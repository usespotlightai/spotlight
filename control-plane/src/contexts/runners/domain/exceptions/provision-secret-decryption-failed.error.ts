export class ProvisionSecretDecryptionFailedError extends Error {
  constructor(poolId: string) {
    super(
      `Cannot decrypt the provision secret of runner pool ${poolId} with the keys of this deployment.`,
    );
    this.name = 'ProvisionSecretDecryptionFailedError';
  }
}
