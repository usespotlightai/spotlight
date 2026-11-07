import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class TerraformStateDivergedError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(name: string, serial: number) {
    super(
      `Terraform state ${name} is already at serial ${serial} with other content, so this state was not written. Another run changed it; run terraform plan again from the latest state.`,
    );
    this.name = 'TerraformStateDivergedError';
  }
}
