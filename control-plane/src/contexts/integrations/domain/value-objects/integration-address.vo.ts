import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { areWords } from '@shared-kernel/domain/value-objects/identifier-shapes';

const SEPARATOR = '/';

const refused = (): never => {
  throw new InvalidIdentifierError(
    'integration address',
    'is the team key and the host it is for, as in core/linear',
  );
};

export class IntegrationAddress {
  private readonly kind = 'integration-address';

  private constructor(
    readonly teamKey: string,
    readonly source: SourceKey,
  ) {}

  static of(teamKey: string, source: SourceKey): IntegrationAddress {
    return areWords(teamKey)
      ? new IntegrationAddress(teamKey, source)
      : refused();
  }

  static parse(held: string): IntegrationAddress {
    const [teamKey, source, ...rest] = held.trim().split(SEPARATOR);

    return teamKey && source && rest.length === 0
      ? IntegrationAddress.of(teamKey, SourceKey.of(source))
      : refused();
  }

  equals(other: IntegrationAddress): boolean {
    return (
      this.kind === other.kind &&
      this.teamKey === other.teamKey &&
      this.source.equals(other.source)
    );
  }

  toString(): string {
    return [this.teamKey, this.source.value].join(SEPARATOR);
  }
}
