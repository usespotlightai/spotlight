import { InvalidSecretError } from '@secrets/domain/exceptions/invalid-secret.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export const SECRET_SOURCE_KINDS = ['built-in', 'aws-secrets-manager'] as const;

export type SecretSourceKind = (typeof SECRET_SOURCE_KINDS)[number];

export interface SourceInNetwork {
  readonly kind: Exclude<SecretSourceKind, 'built-in'>;
  readonly secretId: string;
  readonly field: string | null;
}

const AWS_SECRET_ID = /^[A-Za-z0-9/_+=.@:-]{1,2048}$/;

const FIELD = /^[^\s]{1,256}$/;

export class SecretSource {
  private constructor(
    readonly kind: SecretSourceKind,
    readonly secretId: string | null,
    readonly field: string | null,
  ) {}

  static builtIn(): SecretSource {
    return new SecretSource('built-in', null, null);
  }

  static awsSecretsManager(input: {
    secretId: string;
    field?: string | null;
  }): SecretSource {
    const secretId = input.secretId.trim();
    const field = input.field?.trim() || null;

    if (!AWS_SECRET_ID.test(secretId)) {
      throw new InvalidSecretError(
        ['source', 'secretId'],
        'must be a secret name or ARN in AWS Secrets Manager, as in arn:aws:secretsmanager:eu-west-1:123456789012:secret:linear-api-key',
      );
    }

    if (field !== null && !FIELD.test(field)) {
      throw new InvalidSecretError(
        ['source', 'field'],
        'must be one key of the secret’s JSON, as in token',
      );
    }

    return new SecretSource('aws-secrets-manager', secretId, field);
  }

  get isBuiltIn(): boolean {
    return this.kind === 'built-in';
  }

  get readInNetwork(): SourceInNetwork | null {
    if (this.kind === 'built-in') {
      return null;
    }

    if (!this.secretId) {
      throw new InconsistentStateError(
        'secret source',
        'reads from AWS Secrets Manager without naming the secret there',
      );
    }

    return { kind: this.kind, secretId: this.secretId, field: this.field };
  }

  equals(other: SecretSource): boolean {
    return (
      this.kind === other.kind &&
      this.secretId === other.secretId &&
      this.field === other.field
    );
  }
}
