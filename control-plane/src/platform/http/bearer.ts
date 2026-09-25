const SCHEME = 'Bearer ';

export const bearerIn = (header: string | undefined): string | undefined =>
  header?.startsWith(SCHEME) ? header.slice(SCHEME.length) : undefined;

export const TRUST_HEADER = 'spotlight-trust';
