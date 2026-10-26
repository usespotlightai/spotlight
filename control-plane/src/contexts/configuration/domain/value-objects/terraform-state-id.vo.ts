import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class TerraformStateId {
  private readonly kind = 'terraform-state';

  private constructor(readonly value: string) {}

  static of(value: string): TerraformStateId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('Terraform state');
    }

    return new TerraformStateId(value);
  }

  equals(other: TerraformStateId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
