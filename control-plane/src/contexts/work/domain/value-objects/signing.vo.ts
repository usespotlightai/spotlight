import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

const SIGNING_SCHEMES = [
  'hmac-sha256',
  'hmac-sha1',
  'hmac-sha512',
  'token',
] as const;

export type SigningScheme = (typeof SIGNING_SCHEMES)[number];

const SIGNING_ENCODINGS = ['hex', 'base64'] as const;

export type SigningEncoding = (typeof SIGNING_ENCODINGS)[number];

// There is no unsigned option on purpose. Agents act on all that a delivery says.
export class Signing {
  private constructor(
    readonly scheme: SigningScheme,
    readonly header: string,
    readonly secret: SecretName,
    readonly encoding: SigningEncoding,
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
        'must name the header that carries the signature of the service',
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

  equals(other: Signing): boolean {
    return (
      this.scheme === other.scheme &&
      this.header === other.header &&
      this.secret.equals(other.secret) &&
      this.encoding === other.encoding &&
      this.prefix === other.prefix
    );
  }
}
