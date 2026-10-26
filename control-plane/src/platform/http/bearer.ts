const SCHEME = 'bearer ';

export const bearerIn = (header: string | undefined): string | undefined =>
  header?.slice(0, SCHEME.length).toLowerCase() === SCHEME
    ? header.slice(SCHEME.length)
    : undefined;

const BASIC = 'basic ';

export const basicPasswordIn = (
  header: string | undefined,
): string | undefined => {
  if (header?.slice(0, BASIC.length).toLowerCase() !== BASIC) {
    return undefined;
  }

  const decoded = Buffer.from(header.slice(BASIC.length), 'base64').toString(
    'utf8',
  );
  const colon = decoded.indexOf(':');

  return colon >= 0 && colon < decoded.length - 1
    ? decoded.slice(colon + 1)
    : undefined;
};

export const TRUST_HEADER = 'spotlight-trust';
