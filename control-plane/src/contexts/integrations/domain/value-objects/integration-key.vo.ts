import { InvalidIntegrationError } from '@integrations/domain/exceptions/invalid-integration.error';
import type { HappeningName } from '@integrations/domain/value-objects/happening-name.vo';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { isIntegrationKey } from '@shared-kernel/domain/value-objects/identifier-shapes';

export class IntegrationKey {
  private readonly kind = 'integration-key';

  private constructor(readonly value: string) {}

  static of(raw: string): IntegrationKey {
    const named = raw.trim();

    if (!isIntegrationKey(named)) {
      throw new InvalidIdentifierError(
        'integration',
        'is the name of the integration, as in slack',
      );
    }

    return new IntegrationKey(named);
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
