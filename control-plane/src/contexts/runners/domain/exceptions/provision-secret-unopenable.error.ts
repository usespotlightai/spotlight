export class ProvisionSecretUnopenableError extends Error {
  constructor(poolId: string) {
    super(
      `The provision secret of runner pool ${poolId} does not open with this deployment's keys`,
    );
    this.name = 'ProvisionSecretUnopenableError';
  }
}
