import { createSign } from 'node:crypto';
import type { Env } from '@infrastructure/config/env.schema';

// GitHub refuses a token minted more than ten minutes ahead of its clock.
const JWT_LIFETIME_SECONDS = 540;

const base64url = (value: Buffer | string): string =>
  Buffer.from(value).toString('base64url');

export const assertionFor = (env: Env): string => {
  const issued = Math.floor(Date.now() / 1000);
  const claims = {
    iat: issued - 60,
    exp: issued + JWT_LIFETIME_SECONDS,
    iss: env.GITHUB_APP_ID,
  };

  const signed = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(
    JSON.stringify(claims),
  )}`;

  const signature = createSign('RSA-SHA256')
    .update(signed)
    .sign(env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n'));

  return `${signed}.${base64url(signature)}`;
};
