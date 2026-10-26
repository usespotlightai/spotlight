export class TerraformStateLockLostError extends Error {
  readonly kind = 'conflict' as const;

  constructor(name: string, id: string) {
    super(
      `Terraform state ${name} is no longer locked by ${id}, so the state was not written. Run the command again to take the lock.`,
    );
    this.name = 'TerraformStateLockLostError';
  }
}
