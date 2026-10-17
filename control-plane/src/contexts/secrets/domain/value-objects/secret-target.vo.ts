import { InvalidSecretError } from '@secrets/domain/exceptions/invalid-secret.error';
import {
  SECRET_LOCATIONS,
  type SecretLocation,
} from '@shared-kernel/domain/value-objects/secret-locations';

const HEADER = /^[!#$%&'*+.^_`|~0-9a-z-]{1,128}$/;

const NEVER_INJECTED = new Set([
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

const isLocation = (location: string): location is SecretLocation =>
  (SECRET_LOCATIONS as readonly string[]).includes(location);

export class SecretTarget {
  private constructor(
    readonly location: SecretLocation,
    readonly name: string,
  ) {}

  static of(input: {
    location?: string | null;
    name?: string | null;
  }): SecretTarget {
    const location = input.location ?? 'header';

    if (!isLocation(location)) {
      throw new InvalidSecretError(
        'location',
        'is where Spotlight injects the secret: header or query',
      );
    }

    return location === 'header'
      ? SecretTarget.header(input.name ?? DEFAULT_HEADER)
      : SecretTarget.query(input.name ?? '');
  }

  private static header(written: string): SecretTarget {
    const name = written.trim().toLowerCase();

    if (!HEADER.test(name) || NEVER_INJECTED.has(name)) {
      throw new InvalidSecretError(
        'name',
        'is the request header that Spotlight injects the secret in, as in authorization or x-api-key',
      );
    }

    return new SecretTarget('header', name);
  }

  private static query(written: string): SecretTarget {
    const name = written.trim();

    if (!QUERY.test(name)) {
      throw new InvalidSecretError(
        'name',
        'is the query parameter that Spotlight injects the secret in, as in key or api_key',
      );
    }

    return new SecretTarget('query', name);
  }

  equals(other: SecretTarget): boolean {
    return this.location === other.location && this.name === other.name;
  }
}
