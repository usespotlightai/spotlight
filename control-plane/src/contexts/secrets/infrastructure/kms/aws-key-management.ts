import {
  DecryptCommand,
  GenerateDataKeyCommand,
  type KMSClient,
} from '@aws-sdk/client-kms';
import type {
  IssuedDataKey,
  KeyContext,
  KeyManagement,
} from '@secrets/infrastructure/kms/key-management';

type Kms = Pick<KMSClient, 'send'>;

export class AwsKeyManagement implements KeyManagement {
  constructor(
    private readonly kms: Kms,
    readonly keyId: string,
  ) {}

  async issue(context: KeyContext): Promise<IssuedDataKey> {
    const issued = await this.kms.send(
      new GenerateDataKeyCommand({
        KeyId: this.keyId,
        KeySpec: 'AES_256',
        EncryptionContext: { ...context },
      }),
    );

    if (!issued.Plaintext || !issued.CiphertextBlob) {
      throw new Error('AWS KMS issued a data key without its parts');
    }

    return {
      plain: issued.Plaintext,
      wrapped: Buffer.from(issued.CiphertextBlob).toString('base64'),
    };
  }

  async unwrap(wrapped: string, context: KeyContext): Promise<Uint8Array> {
    const unwrapped = await this.kms.send(
      new DecryptCommand({
        KeyId: this.keyId,
        CiphertextBlob: Buffer.from(wrapped, 'base64'),
        EncryptionContext: { ...context },
      }),
    );

    if (!unwrapped.Plaintext) {
      throw new Error('AWS KMS unwrapped a data key to nothing');
    }

    return unwrapped.Plaintext;
  }
}
