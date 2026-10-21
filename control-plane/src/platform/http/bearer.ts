const SCHEME = 'bearer ';

export const bearerIn = (header: string | undefined): string | undefined =>
  header?.slice(0, SCHEME.length).toLowerCase() === SCHEME
    ? header.slice(SCHEME.length)
    : undefined;

export const TRUST_HEADER = 'spotlight-trust';
