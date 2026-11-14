export const RESERVED_SECRET_PREFIX = 'SPOTLIGHT_';

export const isReservedSecretName = (name: string): boolean =>
  name.startsWith(RESERVED_SECRET_PREFIX);
