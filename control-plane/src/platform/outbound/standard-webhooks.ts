import { createHmac } from 'node:crypto';

const SECRET_PREFIX = 'whsec_';

// A signing secret as an environment variable gives it: whsec_ followed by 24 to 64 base64-encoded bytes.
export const SECRET_PATTERN = /^whsec_[A-Za-z0-9+/]{32,88}={0,2}$/;

// The signing key of a whsec_ secret: the base64 bytes after the prefix.
export const keyOf = (secret: string): Buffer =>
  Buffer.from(secret.slice(SECRET_PREFIX.length), 'base64');

export const signatureOf = (
  key: Buffer,
  id: string,
  timestamp: number,
  body: string,
): string =>
  `v1,${createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64')}`;
