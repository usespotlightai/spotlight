import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  CATALOG_INTEGRATION,
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
        'must be lowercase words joined by dashes (e.g. pull-request), an integration tool (e.g. linear.comment) or a catalog tool id (e.g. catalog.web-search@1.1.0)',
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

    return integration === CATALOG_INTEGRATION ? 'catalog' : 'integration';
  }

  equals(other: Tool): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
