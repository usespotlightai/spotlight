import {
  GetSecretValueCommand,
  type SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import type {
  SecretReference,
  SecretSourcePort,
} from '@secrets/application/ports/secret-source.port';
import { UnreadableSecretError } from '@secrets/domain/exceptions/unreadable-secret.error';
import { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';

type SecretsManager = Pick<SecretsManagerClient, 'send'>;

const fieldOf = (
  secret: SecretReference,
  held: string,
  field: string,
): string => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(held);
  } catch {
    throw new UnreadableSecretError(
      secret.name.value,
      `its value in AWS Secrets Manager is not JSON, so it has no ${field} field`,
    );
  }

  const read =
    parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)[field]
      : undefined;

  if (typeof read !== 'string' || read.length === 0) {
    throw new UnreadableSecretError(
      secret.name.value,
      `its value in AWS Secrets Manager holds no text at ${field}`,
    );
  }

  return read;
};

export class AwsSecretsManagerSource implements SecretSourcePort {
  constructor(private readonly client: SecretsManager | null) {}

  async read(secret: SecretReference): Promise<SecretValue> {
    const secretId = secret.source.secretId;

    if (!this.client || !secretId) {
      throw new UnreadableSecretError(
        secret.name.value,
        'this deployment does not read from AWS Secrets Manager',
      );
    }

    let held: string | undefined;

    try {
      held = (
        await this.client.send(
          new GetSecretValueCommand({ SecretId: secretId }),
        )
      ).SecretString;
    } catch (error) {
      throw new UnreadableSecretError(
        secret.name.value,
        `AWS Secrets Manager answered ${(error as { name?: string }).name ?? 'with an error'}`,
      );
    }

    if (!held) {
      throw new UnreadableSecretError(
        secret.name.value,
        'AWS Secrets Manager holds no text for it',
      );
    }

    return SecretValue.of(
      secret.source.field ? fieldOf(secret, held, secret.source.field) : held,
      'value',
    );
  }
}
