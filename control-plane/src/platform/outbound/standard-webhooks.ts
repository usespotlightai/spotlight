import { createHmac } from 'node:crypto';

export const signatureOf = (
  key: Buffer,
  id: string,
  timestamp: number,
  body: string,
): string =>
  `v1,${createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64')}`;
