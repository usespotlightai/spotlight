import {
  DecryptCommand,
  GenerateDataKeyCommand,
  InvalidCiphertextException,
  type KMSClient,
  KMSInternalException,
} from '@aws-sdk/client-kms';
import { DecryptionFailedError } from '@secrets/infrastructure/crypto/envelope';
import { AwsKeyManagement } from '@secrets/infrastructure/kms/aws-key-management';
import { describe, expect, it, vi } from 'vitest';

const KEY_ID = 'arn:aws:kms:eu-west-1:123456789012:key/abc';
const CONTEXT = { purpose: 'spotlight-secrets', workspace: 'ws_1' };
const PLAIN = new Uint8Array(32).fill(7);
const BLOB = new Uint8Array([1, 2, 3]);

const kmsAnswering = () => {
  const send = vi
    .fn()
    .mockImplementation(async (command: unknown) =>
      command instanceof GenerateDataKeyCommand
        ? { Plaintext: PLAIN, CiphertextBlob: BLOB }
        : { Plaintext: PLAIN },
    );
  const kms: Pick<KMSClient, 'send'> = { send };

  return { send, kms };
};

describe('AwsKeyManagement', () => {
  it('requests an AES-256 data key from KMS, bound to the workspace', async () => {
    const { send, kms } = kmsAnswering();

    const issued = await new AwsKeyManagement(kms, KEY_ID).issue(CONTEXT);

    const command: unknown = send.mock.calls[0]?.[0];
    if (!(command instanceof GenerateDataKeyCommand)) {
      throw new Error('expected a GenerateDataKeyCommand');
    }
    expect(command.input).toEqual({
      KeyId: KEY_ID,
      KeySpec: 'AES_256',
      EncryptionContext: CONTEXT,
    });
    expect(issued).toEqual({
      plain: PLAIN,
      wrapped: Buffer.from(BLOB).toString('base64'),
    });
  });

  it('unwraps with the same key and workspace context', async () => {
    const { send, kms } = kmsAnswering();

    await expect(
      new AwsKeyManagement(kms, KEY_ID).unwrap(
        Buffer.from(BLOB).toString('base64'),
        CONTEXT,
      ),
    ).resolves.toEqual(PLAIN);

    const command: unknown = send.mock.calls[0]?.[0];
    if (!(command instanceof DecryptCommand)) {
      throw new Error('expected a DecryptCommand');
    }
    expect(command.input).toEqual({
      KeyId: KEY_ID,
      CiphertextBlob: Buffer.from(BLOB),
      EncryptionContext: CONTEXT,
    });
  });

  it('says that a data key that another KMS key wrapped does not decrypt', async () => {
    const kms: Pick<KMSClient, 'send'> = {
      send: vi
        .fn()
        .mockRejectedValue(
          new InvalidCiphertextException({ message: 'no', $metadata: {} }),
        ),
    };

    await expect(
      new AwsKeyManagement(kms, KEY_ID).unwrap('d3JhcHBlZA==', CONTEXT),
    ).rejects.toBeInstanceOf(DecryptionFailedError);
  });

  it('lets a passing KMS failure through as it is', async () => {
    const throttled = new KMSInternalException({
      message: 'slow',
      $metadata: {},
    });
    const kms: Pick<KMSClient, 'send'> = {
      send: vi.fn().mockRejectedValue(throttled),
    };

    await expect(
      new AwsKeyManagement(kms, KEY_ID).unwrap('d3JhcHBlZA==', CONTEXT),
    ).rejects.toBe(throttled);
  });

  it('rejects a data key KMS issued without its parts', async () => {
    const kms: Pick<KMSClient, 'send'> = {
      send: vi.fn().mockResolvedValue({}),
    };

    await expect(
      new AwsKeyManagement(kms, KEY_ID).issue(CONTEXT),
    ).rejects.toThrow(/without its parts/);
  });
});
