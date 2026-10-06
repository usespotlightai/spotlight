export class ProvisionSecretUnopenableError extends Error {
  constructor(poolId: string) {
    super(
      `Provision secret of runner pool ${poolId} doesn't open with this deployment's keys.`,
    );
    this.name = 'ProvisionSecretUnopenableError';
  }
}
