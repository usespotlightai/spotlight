import { SecretValueFromTerraformError } from '@secrets/domain/exceptions/secret-value-from-terraform.error';

export const SECRET_VALUE_ORIGINS = [
  'awaiting',
  'spotlight',
  'terraform',
] as const;

export type SecretValueOriginKind = (typeof SECRET_VALUE_ORIGINS)[number];

export class SecretValueOrigin {
  private constructor(
    readonly kind: SecretValueOriginKind,
    private readonly valueVersion: number | null,
  ) {}

  static of(secret: {
    readonly valueVersion: number | null;
    readonly holdsValue: boolean;
  }): SecretValueOrigin {
    if (secret.valueVersion !== null) {
      return new SecretValueOrigin('terraform', secret.valueVersion);
    }

    return new SecretValueOrigin(
      secret.holdsValue ? 'spotlight' : 'awaiting',
      null,
    );
  }

  get awaitsValue(): boolean {
    return this.kind === 'awaiting';
  }

  get settable(): boolean {
    return this.valueVersion === null;
  }

  assertSettable(secretName: string): void {
    if (this.valueVersion !== null) {
      throw new SecretValueFromTerraformError(secretName, this.valueVersion);
    }
  }
}
