import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  INTEGRATION_KEY_SHAPE,
  SLUG_SHAPE,
} from '@shared-kernel/domain/value-objects/identifier-shapes';

const PROVIDED = new RegExp(`^${INTEGRATION_KEY_SHAPE}\\.${SLUG_SHAPE}$`);

export class ToolName {
  private constructor(readonly value: string) {}

  static of(raw: string): ToolName {
    const trimmed = raw.trim();

    if (!PROVIDED.test(trimmed)) {
      throw new InvalidIdentifierError(
        'tool',
        'is named for the integration that offers it, as in linear.comment',
      );
    }

    return new ToolName(trimmed);
  }

  static parsed(raw: string): ToolName | null {
    const trimmed = raw.trim();

    return PROVIDED.test(trimmed) ? new ToolName(trimmed) : null;
  }

  get integration(): IntegrationKey {
    return IntegrationKey.of(this.value.slice(0, this.value.indexOf('.')));
  }

  get name(): string {
    return this.value.slice(this.value.indexOf('.') + 1);
  }

  equals(other: ToolName): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
