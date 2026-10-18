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
  text: string,
  field: string,
): string => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new UnreadableSecretError(
      secret.name.value,
      `Its AWS Secrets Manager value is not JSON. Field expected: ${field}`,
    );
  }

  const read =
    parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)[field]
      : undefined;

  if (typeof read !== 'string' || read.length === 0) {
    throw new UnreadableSecretError(
      secret.name.value,
      `Its AWS Secrets Manager value has no text at ${field}.`,
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
        'This deployment does not read from AWS Secrets Manager.',
      );
    }

    let text: string | undefined;

    try {
      text = (
        await this.client.send(
          new GetSecretValueCommand({ SecretId: secretId }),
        )
      ).SecretString;
    } catch (error) {
      throw new UnreadableSecretError(
        secret.name.value,
        `AWS Secrets Manager returned ${(error as { name?: string }).name ?? 'an error'}.`,
      );
    }

    if (!text) {
      throw new UnreadableSecretError(
        secret.name.value,
        'AWS Secrets Manager has no text for it.',
      );
    }

    return SecretValue.of(
      secret.source.field ? fieldOf(secret, text, secret.source.field) : text,
      'value',
    );
  }
}
