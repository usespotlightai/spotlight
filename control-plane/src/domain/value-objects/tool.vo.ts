import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';
import { WORDS } from '@domain/value-objects/identifier-shapes';
import type { SourceKey } from '@domain/value-objects/source-key.vo';

const SHAPE = new RegExp(`^${WORDS}(\\.${WORDS})?$`);

export class Tool {
  private constructor(readonly value: string) {}

  static of(raw: string): Tool {
    const trimmed = raw.trim();

    if (!SHAPE.test(trimmed)) {
      throw new InvalidIdentifierError(
        'tool',
        'is lower case words joined by dashes, as in pull-request, or named for the integration it comes from, as in linear.comment',
      );
    }

    return new Tool(trimmed);
  }

  static offeredBy(source: SourceKey, name: string): Tool {
    return Tool.of(`${source.value}.${name}`);
  }

  isOfferedBy(source: SourceKey): boolean {
    return this.integration === source.value;
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
