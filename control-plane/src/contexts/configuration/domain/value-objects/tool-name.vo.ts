import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { isToolName } from '@shared-kernel/domain/value-objects/identifier-shapes';

export class ToolName {
  private constructor(readonly value: string) {}

  static of(raw: string): ToolName {
    const trimmed = raw.trim();

    if (!isToolName(trimmed)) {
      throw new InvalidIdentifierError(
        'tool',
        'must be lowercase words joined by dashes, as in pull-request or linear.comment',
      );
    }

    return new ToolName(trimmed);
  }

  get integration(): string | null {
    const at = this.value.indexOf('.');

    return at === -1 ? null : this.value.slice(0, at);
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
