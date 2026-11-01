import {
  createDecipheriv,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  type KeyObject,
} from 'node:crypto';

export const recipient = () => {
  const pair = generateKeyPairSync('x25519');
  const raw = Buffer.from(
    pair.publicKey.export({ format: 'jwk' }).x ?? '',
    'base64url',
  );

  return { privateKey: pair.privateKey, raw, written: raw.toString('base64') };
};

export const opened = (
  sealed: string,
  to: { privateKey: KeyObject; raw: Buffer },
  boundTo: string,
  secret: string,
): string => {
  const [, ephemeral, iv, tag, encrypted] = sealed.split('.');
  const ephemeralRaw = Buffer.from(ephemeral ?? '', 'base64');
  const shared = diffieHellman({
    privateKey: to.privateKey,
    publicKey: createPublicKey({
      key: { kty: 'OKP', crv: 'X25519', x: ephemeralRaw.toString('base64url') },
      format: 'jwk',
    }),
  });
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(
      hkdfSync(
        'sha256',
        shared,
        Buffer.concat([ephemeralRaw, to.raw]),
        'spotlight:egress-seal:v1',
        32,
      ),
    ),
    Buffer.from(iv ?? '', 'base64'),
  );
  decipher.setAAD(
    Buffer.from(['spotlight:egress:v1', boundTo, secret].join('\u0000')),
  );
  decipher.setAuthTag(Buffer.from(tag ?? '', 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted ?? '', 'base64')),
    decipher.final(),
  ]).toString('utf8');
};
