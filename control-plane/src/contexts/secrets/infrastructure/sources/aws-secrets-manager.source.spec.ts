import {
  GetSecretValueCommand,
  type SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import type { SecretReference } from '@secrets/application/ports/secret-source.port';
import { UnreadableSecretError } from '@secrets/domain/exceptions/unreadable-secret.error';
import { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import { SecretSource } from '@secrets/domain/value-objects/secret-source.vo';
import { AwsSecretsManagerSource } from '@secrets/infrastructure/sources/aws-secrets-manager.source';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const reference = (field: string | null = null): SecretReference => ({
  workspaceId: WorkspaceId.of('ws_1'),
  id: SecretId.of('secret_1'),
  name: SecretName.of('LINEAR_API_KEY'),
  source: SecretSource.awsSecretsManager({ secretId: 'linear', field }),
});

const setUp = (answer: () => Promise<unknown>) => {
  const send = vi.fn(answer);

  return {
    send,
    source: new AwsSecretsManagerSource({
      send,
    } as unknown as Pick<SecretsManagerClient, 'send'>),
  };
};

describe('AwsSecretsManagerSource', () => {
  it('reads the current value of the secret it names', async () => {
    const { send, source } = setUp(async () => ({
      SecretString: 'lin_api_1',
    }));

    expect((await source.read(reference())).revealed()).toBe('lin_api_1');

    const [command] = send.mock.calls[0] as unknown as [GetSecretValueCommand];
    expect(command).toBeInstanceOf(GetSecretValueCommand);
    expect(command.input).toEqual({ SecretId: 'linear' });
  });

  it('reads one field of a secret that contains JSON', async () => {
    const { source } = setUp(async () => ({
      SecretString: JSON.stringify({ token: 'lin_api_2', other: 'x' }),
    }));

    expect((await source.read(reference('token'))).revealed()).toBe(
      'lin_api_2',
    );
  });

  it('says what went wrong without saying the value', async () => {
    const { source } = setUp(async () => ({
      SecretString: 'lin_api_1',
    }));

    const refused = source.read(reference('token'));

    await expect(refused).rejects.toThrow(UnreadableSecretError);
    await expect(refused).rejects.not.toThrow(/lin_api_1/);
  });

  it('turns a refusal from AWS into one of its own', async () => {
    const { source } = setUp(async () => {
      throw Object.assign(new Error('denied'), {
        name: 'AccessDeniedException',
      });
    });

    await expect(source.read(reference())).rejects.toThrow(
      /AccessDeniedException/,
    );
  });

  it('reads nothing where the deployment does not use AWS Secrets Manager', async () => {
    await expect(
      new AwsSecretsManagerSource(null).read(reference()),
    ).rejects.toThrow(/does not read from AWS Secrets Manager/);
  });
});
