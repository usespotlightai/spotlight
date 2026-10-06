import { InvalidSecretError } from '@secrets/domain/exceptions/invalid-secret.error';
import type { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';

const LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';

const HOST = new RegExp(`^(?=.{1,253}$)${LABEL}(?:\\.${LABEL})+$`);

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

const PREFIX = /^[\x20-\x7e]{0,64}$/;

const DEFAULT_HEADER = 'authorization';

export interface WornHeader {
  readonly name: string;
  readonly value: string;
}

export class SecretBinding {
  private constructor(
    readonly host: string,
    readonly header: string,
    readonly prefix: string,
  ) {}

  static of(input: {
    host: string;
    header?: string | null;
    prefix?: string | null;
  }): SecretBinding {
    const host = input.host.trim().toLowerCase();
    const header = (input.header ?? DEFAULT_HEADER).trim().toLowerCase();
    const prefix = input.prefix ?? '';

    if (!HOST.test(host)) {
      throw new InvalidSecretError(
        'host',
        'must be one host with no scheme, port or path, as in api.linear.app',
      );
    }

    if (!HEADER.test(header) || NEVER_WORN.has(header)) {
      throw new InvalidSecretError(
        'header',
        'must be a request header name, as in authorization or x-api-key',
      );
    }

    if (!PREFIX.test(prefix)) {
      throw new InvalidSecretError(
        'prefix',
        'must be at most 64 printable characters, as in "Bearer "',
      );
    }

    return new SecretBinding(host, header, prefix);
  }

  toward(url: URL): boolean {
    return url.protocol === 'https:' && url.hostname === this.host;
  }

  wear(value: SecretValue): WornHeader {
    return { name: this.header, value: `${this.prefix}${value.revealed()}` };
  }

  sameHeaderAs(other: SecretBinding): boolean {
    return this.host === other.host && this.header === other.header;
  }

  equals(other: SecretBinding): boolean {
    return this.sameHeaderAs(other) && this.prefix === other.prefix;
  }
}
