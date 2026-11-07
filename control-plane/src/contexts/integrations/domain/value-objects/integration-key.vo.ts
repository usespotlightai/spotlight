import { InvalidIntegrationError } from '@integrations/domain/exceptions/invalid-integration.error';
import type { HappeningName } from '@integrations/domain/value-objects/happening-name.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  CATALOG_INTEGRATION,
  isIntegrationKey,
} from '@shared-kernel/domain/value-objects/identifier-shapes';

export class IntegrationKey {
  private readonly kind = 'integration-key';

  static readonly RESERVED =
    'is catalog, which is the name of Spotlight’s catalog. Please give the integration another name';

  private constructor(readonly value: string) {}

  static isReserved(named: string): boolean {
    return named === CATALOG_INTEGRATION;
  }

  static of(raw: string): IntegrationKey {
    const named = raw.trim();

    if (!isIntegrationKey(named)) {
      throw new InvalidIdentifierError(
        'integration',
        'is the name of the integration, as in slack',
      );
    }

    if (IntegrationKey.isReserved(named)) {
      throw new InvalidIdentifierError('integration', IntegrationKey.RESERVED);
    }

    return new IntegrationKey(named);
  }

  static rehydrate(stored: string): IntegrationKey {
    if (!isIntegrationKey(stored)) {
      throw new InconsistentStateError(
        'integration',
        'was stored in a shape it cannot take',
      );
    }

    return new IntegrationKey(stored);
  }

  static maybe(raw: string): IntegrationKey | null {
    const named = raw.trim();

    return isIntegrationKey(named) && !IntegrationKey.isReserved(named)
      ? new IntegrationKey(named)
      : null;
  }

  raises(happening: { readonly integration: string }): boolean {
    return happening.integration === this.value;
  }

  claim(happening: HappeningName): HappeningName {
    if (!this.raises(happening)) {
      throw new InvalidIntegrationError(
        this.value,
        `raises ${happening.value} without the ${this.value}. prefix`,
      );
    }

    return happening;
  }

  equals(other: IntegrationKey): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
