import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';

/** The same shape a happening's source has: they name the same hosts. */
const SOURCE = /^[a-z0-9]+$/;

/**
 * Where a workspace reaches one host, in whatever way that host counts it:
 * GitHub numbers an installation, another names a team or a project. What
 * the number means is the source's to know. All this holds is which host it
 * belongs to and what it calls this workspace, which is enough to bring a
 * delivery home.
 */
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

    // A host that names nothing has connected nothing: an empty identifier
    // would match every other workspace that had none either.
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
