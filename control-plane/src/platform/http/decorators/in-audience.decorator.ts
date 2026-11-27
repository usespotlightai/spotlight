import { type CustomDecorator, SetMetadata } from '@nestjs/common';

const AUDIENCES = [
  'web',
  'resources',
  'automation',
  'hosts',
  'public',
  'admin',
] as const;

export type Audience = (typeof AUDIENCES)[number];

export const perAudience = <T>(
  make: (audience: Audience) => T,
): Record<Audience, T> => ({
  web: make('web'),
  resources: make('resources'),
  automation: make('automation'),
  hosts: make('hosts'),
  public: make('public'),
  admin: make('admin'),
});

export const IN_AUDIENCE = Symbol('IN_AUDIENCE');

export const InAudience = (audience: Audience): CustomDecorator<symbol> =>
  SetMetadata(IN_AUDIENCE, audience);
