import {
  createCipheriv,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  type KeyObject,
  randomBytes,
} from 'node:crypto';
import { UnsealableRecipientError } from '@secrets/application/errors/unsealable-recipient.error';
import type {
  RunSealingPort,
  SealedFor,
  SealingRecipient,
} from '@secrets/application/ports/run-sealing.port';
import type { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';

const VERSION = 'v1';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const INFO = 'spotlight:egress-seal:v1';

const rawOf = (key: KeyObject): Buffer => {
  const { x } = key.export({ format: 'jwk' });

  return Buffer.from(x ?? '', 'base64url');
};

const parsed = (written: string): { key: KeyObject; raw: Buffer } => {
  const raw = Buffer.from(written, 'base64');

  if (raw.length !== KEY_BYTES || raw.toString('base64') !== written) {
    throw new UnsealableRecipientError();
  }

  try {
    return {
      key: createPublicKey({
        key: { kty: 'OKP', crv: 'X25519', x: raw.toString('base64url') },
        format: 'jwk',
      }),
      raw,
    };
  } catch {
    throw new UnsealableRecipientError();
  }
};

const boundTo = (sealedFor: SealedFor): string =>
  ['spotlight:egress:v1', sealedFor.runId, sealedFor.secretName].join('\u0000');

export class X25519RunSealing implements RunSealingPort {
  recipientOf(written: string): SealingRecipient {
    const recipient = parsed(written);

    try {
      diffieHellman({
        privateKey: generateKeyPairSync('x25519').privateKey,
        publicKey: recipient.key,
      });
    } catch {
      throw new UnsealableRecipientError();
    }

    return { key: written };
  }

  seal(value: SecretValue, to: SealingRecipient, sealedFor: SealedFor): string {
    const recipient = parsed(to.key);
    const ephemeral = generateKeyPairSync('x25519');
    const ephemeralRaw = rawOf(ephemeral.publicKey);

    const key = Buffer.from(
      hkdfSync(
        'sha256',
        diffieHellman({
          privateKey: ephemeral.privateKey,
          publicKey: recipient.key,
        }),
        Buffer.concat([ephemeralRaw, recipient.raw]),
        INFO,
        KEY_BYTES,
      ),
    );

    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(boundTo(sealedFor), 'utf8'));

    const encrypted = Buffer.concat([
      cipher.update(value.revealed(), 'utf8'),
      cipher.final(),
    ]);

    return [
      VERSION,
      ephemeralRaw.toString('base64'),
      iv.toString('base64'),
      cipher.getAuthTag().toString('base64'),
      encrypted.toString('base64'),
    ].join('.');
  }
}
