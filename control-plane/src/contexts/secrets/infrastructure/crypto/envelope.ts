import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const VERSION = 'v1';

export class UnopenableEnvelopeError extends Error {
  constructor(because: string) {
    super(`The envelope does not open: ${because}`);
    this.name = 'UnopenableEnvelopeError';
  }
}

const keyOf = (key: Uint8Array): Buffer => {
  if (key.length !== KEY_BYTES) {
    throw new UnopenableEnvelopeError(`the key is not ${KEY_BYTES} bytes`);
  }

  return Buffer.from(key);
};

export const sealed = (
  key: Uint8Array,
  plain: Uint8Array,
  bound: string,
): string => {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, keyOf(key), iv);

  cipher.setAAD(Buffer.from(bound, 'utf8'));

  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);

  return [
    VERSION,
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    encrypted.toString('base64'),
  ].join('.');
};

export const opened = (
  key: Uint8Array,
  envelope: string,
  bound: string,
): Buffer => {
  const [version, iv, tag, encrypted, ...rest] = envelope.split('.');

  if (
    version !== VERSION ||
    !iv ||
    !tag ||
    encrypted === undefined ||
    rest.length > 0
  ) {
    throw new UnopenableEnvelopeError('it was not sealed by this Spotlight');
  }

  const given = Buffer.from(tag, 'base64');

  if (given.length !== TAG_BYTES) {
    throw new UnopenableEnvelopeError('it has been tampered with');
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    keyOf(key),
    Buffer.from(iv, 'base64'),
  );

  decipher.setAAD(Buffer.from(bound, 'utf8'));
  decipher.setAuthTag(given);

  try {
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64')),
      decipher.final(),
    ]);
  } catch {
    throw new UnopenableEnvelopeError(
      'it was sealed with another key, for something else, or has been tampered with',
    );
  }
};
