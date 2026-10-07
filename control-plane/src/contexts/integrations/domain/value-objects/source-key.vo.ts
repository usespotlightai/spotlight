import { InvalidIntegrationError } from '@integrations/domain/exceptions/invalid-integration.error';
import type { HappeningName } from '@integrations/domain/value-objects/happening-name.vo';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { isSourceWord } from '@shared-kernel/domain/value-objects/identifier-shapes';

export class SourceKey {
  private readonly kind = 'source-key';

  private constructor(readonly value: string) {}

  static of(raw: string): SourceKey {
    const named = raw.trim();

    if (!isSourceWord(named)) {
      throw new InvalidIdentifierError(
        'source',
        'is the one word a host is addressed by, as in github',
      );
    }

    return new SourceKey(named);
  }

  raises(happening: { readonly source: string }): boolean {
    return happening.source === this.value;
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

  equals(other: SourceKey): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
