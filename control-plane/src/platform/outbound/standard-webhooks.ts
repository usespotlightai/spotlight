import { createHmac } from 'node:crypto';

const SECRET_PREFIX = 'whsec_';

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

// Why a call got no answer, with its cause, such as ECONNREFUSED.
export const failureOf = (error: unknown): string => {
  const cause = (error as { cause?: unknown }).cause;

  return error instanceof Error
    ? cause instanceof Error
      ? `${error.message}: ${cause.message || (cause as { code?: string }).code || cause.name}`
      : error.message
    : String(error);
};
