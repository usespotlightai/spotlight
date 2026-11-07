import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class TerraformStateLineageMismatchError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(name: string, kept: string, sent: string) {
    super(
      `Terraform state ${name} has the lineage ${kept}, and this state has ${sent}, so it was not written. Keep the state of another configuration under another state name.`,
    );
    this.name = 'TerraformStateLineageMismatchError';
  }
}
