import { InvalidSecretError } from '@secrets/domain/exceptions/invalid-secret.error';
import {
  SECRET_CARRIERS,
  type SecretCarrierKind,
} from '@shared-kernel/domain/value-objects/secret-carriers';

const HEADER = /^[!#$%&'*+.^_`|~0-9a-z-]{1,128}$/;

const NEVER_WORN = new Set([
  'host',
  'content-length',
  'content-type',
  'transfer-encoding',
  'connection',
  'upgrade',
  'te',
  'trailer',
]);

const QUERY = /^[A-Za-z0-9._~-]{1,128}$/;

const DEFAULT_HEADER = 'authorization';

const isKind = (kind: string): kind is SecretCarrierKind =>
  (SECRET_CARRIERS as readonly string[]).includes(kind);

export class SecretCarrier {
  private constructor(
    readonly kind: SecretCarrierKind,
    readonly name: string,
  ) {}

  static of(input: {
    carrier?: string | null;
    name?: string | null;
  }): SecretCarrier {
    const kind = input.carrier ?? 'header';

    if (!isKind(kind)) {
      throw new InvalidSecretError(
        'carrier',
        'is where the secret is worn: header or query',
      );
    }

    return kind === 'header'
      ? SecretCarrier.header(input.name ?? DEFAULT_HEADER)
      : SecretCarrier.query(input.name ?? '');
  }

  private static header(written: string): SecretCarrier {
    const name = written.trim().toLowerCase();

    if (!HEADER.test(name) || NEVER_WORN.has(name)) {
      throw new InvalidSecretError(
        'name',
        'is the request header the secret is worn in, as in authorization or x-api-key',
      );
    }

    return new SecretCarrier('header', name);
  }

  private static query(written: string): SecretCarrier {
    const name = written.trim();

    if (!QUERY.test(name)) {
      throw new InvalidSecretError(
        'name',
        'is the query parameter the secret is worn in, as in key or api_key',
      );
    }

    return new SecretCarrier('query', name);
  }

  equals(other: SecretCarrier): boolean {
    return this.kind === other.kind && this.name === other.name;
  }
}
