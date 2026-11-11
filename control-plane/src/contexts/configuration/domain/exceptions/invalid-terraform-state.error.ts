import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidTerraformStateError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`The Terraform state ${reason}.`);
    this.name = 'InvalidTerraformStateError';
  }
}
