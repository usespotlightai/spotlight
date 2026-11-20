import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class SecretValueFromTerraformError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(
    readonly secretName: string,
    readonly valueVersion: number,
  ) {
    super(
      `Terraform sets the value of secret ${secretName} (value_wo_version ${valueVersion}). Change the value in Terraform, or remove value_wo_version and value_wo there first.`,
    );
    this.name = 'SecretValueFromTerraformError';
  }
}
