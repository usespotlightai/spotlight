import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  SLUG_SHAPE,
  SOURCE_KEY_SHAPE,
} from '@shared-kernel/domain/value-objects/identifier-shapes';

const OFFERED = new RegExp(`^${SOURCE_KEY_SHAPE}\\.${SLUG_SHAPE}$`);

export class ToolName {
  private constructor(readonly value: string) {}

  static of(raw: string): ToolName {
    const trimmed = raw.trim();

    if (!OFFERED.test(trimmed)) {
      throw new InvalidIdentifierError(
        'tool',
        'is named for the integration that offers it, as in linear.comment',
      );
    }

    return new ToolName(trimmed);
  }

  equals(other: ToolName): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
