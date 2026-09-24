import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  CATALOG_SOURCE,
  isCatalogReference,
  isToolName,
  unversioned,
} from '@shared-kernel/domain/value-objects/identifier-shapes';

export type ToolOrigin = 'built-in' | 'integration' | 'catalog';

export class Tool {
  private constructor(readonly value: string) {}

  static of(raw: string): Tool {
    const trimmed = raw.trim();

    if (!isToolName(trimmed) && !isCatalogReference(trimmed)) {
      throw new InvalidIdentifierError(
        'tool',
        'is lower case words joined by dashes, as in pull-request, named for the integration it comes from, as in linear.comment, or a catalog tool’s id, as in catalog.web-search@1.1.0',
      );
    }

    return new Tool(trimmed);
  }

  get integration(): string | null {
    const at = this.value.indexOf('.');

    return at === -1 ? null : this.value.slice(0, at);
  }

  get name(): string {
    return this.called.slice(this.called.indexOf('.') + 1);
  }

  get called(): string {
    return unversioned(this.value);
  }

  get origin(): ToolOrigin {
    const integration = this.integration;

    if (integration === null) {
      return 'built-in';
    }

    return integration === CATALOG_SOURCE ? 'catalog' : 'integration';
  }

  equals(other: Tool): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
