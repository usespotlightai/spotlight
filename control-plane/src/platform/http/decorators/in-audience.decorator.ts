import { SetMetadata } from '@nestjs/common';

export const AUDIENCES = [
  'web',
  'resources',
  'insights',
  'hosts',
  'public',
] as const;

export type Audience = (typeof AUDIENCES)[number];

export const IN_AUDIENCE = Symbol('IN_AUDIENCE');

export const InAudience = (audience: Audience) =>
  SetMetadata(IN_AUDIENCE, audience);
