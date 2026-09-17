import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { isToolName } from '@shared-kernel/domain/value-objects/identifier-shapes';

export class Tool {
  private constructor(readonly value: string) {}

  static of(raw: string): Tool {
    const trimmed = raw.trim();

    if (!isToolName(trimmed)) {
      throw new InvalidIdentifierError(
        'tool',
        'is lower case words joined by dashes, as in pull-request, or named for the integration it comes from, as in linear.comment',
      );
    }

    return new Tool(trimmed);
  }

  get integration(): string | null {
    const at = this.value.indexOf('.');

    return at === -1 ? null : this.value.slice(0, at);
  }

  get name(): string {
    return this.value.slice(this.value.indexOf('.') + 1);
  }

  equals(other: Tool): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
