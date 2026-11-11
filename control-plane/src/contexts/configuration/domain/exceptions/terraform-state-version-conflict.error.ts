import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class TerraformStateVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(name: string) {
    super(
      `Terraform state ${name} changed while this request ran. Please run the command again.`,
    );
    this.name = 'TerraformStateVersionConflictError';
  }
}
