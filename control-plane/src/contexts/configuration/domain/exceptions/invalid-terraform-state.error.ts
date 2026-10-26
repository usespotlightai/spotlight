export class InvalidTerraformStateError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`The Terraform state ${reason}.`);
    this.name = 'InvalidTerraformStateError';
  }
}
