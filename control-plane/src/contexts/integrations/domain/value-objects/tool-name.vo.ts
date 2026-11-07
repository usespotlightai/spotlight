import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  INTEGRATION_KEY_SHAPE,
  SLUG_SHAPE,
} from '@shared-kernel/domain/value-objects/identifier-shapes';

const SHAPED = new RegExp(`^${INTEGRATION_KEY_SHAPE}\\.${SLUG_SHAPE}$`);

const isProvided = (named: string): boolean =>
  SHAPED.test(named) &&
  !IntegrationKey.isReserved(named.slice(0, named.indexOf('.')));

export class ToolName {
  private constructor(readonly value: string) {}

  static of(raw: string): ToolName {
    const trimmed = raw.trim();

    if (!isProvided(trimmed)) {
      throw new InvalidIdentifierError(
        'tool',
        'is named for the integration that offers it, as in linear.comment',
      );
    }

    return new ToolName(trimmed);
  }

  static rehydrate(stored: string): ToolName {
    if (!SHAPED.test(stored)) {
      throw new InconsistentStateError(
        'tool',
        'was stored in a shape it cannot take',
      );
    }

    return new ToolName(stored);
  }

  static parsed(raw: string): ToolName | null {
    const trimmed = raw.trim();

    return isProvided(trimmed) ? new ToolName(trimmed) : null;
  }

  static parsedAll(raw: readonly string[]): readonly ToolName[] {
    return raw.flatMap((each) => {
      const named = ToolName.parsed(each);

      return named ? [named] : [];
    });
  }

  get integration(): IntegrationKey {
    return IntegrationKey.rehydrate(
      this.value.slice(0, this.value.indexOf('.')),
    );
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
