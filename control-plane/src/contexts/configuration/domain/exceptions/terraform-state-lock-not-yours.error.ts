import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class TerraformStateLockNotYoursError extends DomainError {
  readonly kind = 'not-allowed' as const;

  constructor(name: string, id: string) {
    super(
      `Terraform state ${name} is locked by ${id}, which another token or person took. Releasing it needs the configure permission.`,
    );
    this.name = 'TerraformStateLockNotYoursError';
  }
}
