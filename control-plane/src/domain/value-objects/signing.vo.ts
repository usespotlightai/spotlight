import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';
import type { SecretName } from '@domain/value-objects/secret-name.vo';

/** The only scheme Spotlight verifies by, named so a file has to say it. */
export const SIGNING_SCHEMES = ['hmac-sha256'] as const;

export type SigningScheme = (typeof SIGNING_SCHEMES)[number];

export const SIGNING_ENCODINGS = ['hex', 'base64'] as const;

export type SigningEncoding = (typeof SIGNING_ENCODINGS)[number];

/**
 * How a host proves a delivery is its own. There is no way to express that it
 * does not: an unsigned door takes anybody's word, and an agent runs on it.
 */
export class Signing {
  private constructor(
    readonly scheme: SigningScheme,
    readonly header: string,
    /** Never the secret itself. */
    readonly secret: SecretName,
    readonly encoding: SigningEncoding,
    /** Some hosts write `sha256=` in front of the digest, and some do not. */
    readonly prefix: string,
  ) {}

  static of(input: {
    scheme: SigningScheme;
    header: string;
    secret: SecretName;
    encoding?: SigningEncoding;
    prefix?: string;
  }): Signing {
    const header = input.header.trim().toLowerCase();

    if (header.length === 0) {
      throw new InvalidIdentifierError(
        'signing header',
        'is the header the host puts its signature in',
      );
    }

    return new Signing(
      input.scheme,
      header,
      input.secret,
      input.encoding ?? 'hex',
      input.prefix ?? '',
    );
  }
}
