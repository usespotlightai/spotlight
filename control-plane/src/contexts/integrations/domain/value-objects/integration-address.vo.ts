import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { isSlug } from '@shared-kernel/domain/value-objects/identifier-shapes';

const SEPARATOR = '/';

const invalid = (): never => {
  throw new InvalidIdentifierError(
    'integration address',
    'is the team key and the integration name, as in core/linear',
  );
};

export class IntegrationAddress {
  private readonly kind = 'integration-address';

  private constructor(
    readonly teamKey: string,
    readonly integration: IntegrationKey,
  ) {}

  static of(teamKey: string, integration: IntegrationKey): IntegrationAddress {
    return isSlug(teamKey)
      ? new IntegrationAddress(teamKey, integration)
      : invalid();
  }

  static parse(raw: string): IntegrationAddress {
    const [teamKey, integration, ...rest] = raw.trim().split(SEPARATOR);

    return teamKey && integration && rest.length === 0
      ? IntegrationAddress.of(teamKey, IntegrationKey.of(integration))
      : invalid();
  }

  equals(other: IntegrationAddress): boolean {
    return (
      this.kind === other.kind &&
      this.teamKey === other.teamKey &&
      this.integration.equals(other.integration)
    );
  }

  toString(): string {
    return [this.teamKey, this.integration.value].join(SEPARATOR);
  }
}
