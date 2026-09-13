import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';

const SOURCE = /^[a-z0-9]+$/;

export class Connection {
  private constructor(
    readonly source: string,
    readonly externalId: string,
  ) {}

  static of(source: string, externalId: string): Connection {
    const host = source.trim();
    const named = externalId.trim();

    if (!SOURCE.test(host)) {
      throw new InvalidIdentifierError(
        'connection source',
        'is the name a source is addressed by, as in github',
      );
    }

    if (named.length === 0) {
      throw new InvalidIdentifierError(
        'connection',
        'is what the host calls this workspace',
      );
    }

    return new Connection(host, named);
  }

  isTo(source: string): boolean {
    return this.source === source;
  }

  equals(other: Connection): boolean {
    return this.source === other.source && this.externalId === other.externalId;
  }

  toString(): string {
    return `${this.source}:${this.externalId}`;
  }
}
