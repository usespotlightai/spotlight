import type { SpecDocumentRepository } from '@integrations/domain/repositories/spec-document.repository';
import type { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import type { SpecOperation } from '@integrations/domain/value-objects/spec-operation.vo';

const MAX_ENTRIES = 2000;

export class OperationCache {
  readonly #entries = new Map<string, SpecOperation>();

  constructor(private readonly documents: SpecDocumentRepository) {}

  async of(hash: ContentHash, name: string): Promise<SpecOperation | null> {
    const key = `${hash.value}:${name}`;
    const cached = this.#entries.get(key);

    if (cached) {
      this.#entries.delete(key);
      this.#entries.set(key, cached);

      return cached;
    }

    const found = await this.documents.operation(hash, name);

    if (found) {
      this.#entries.set(key, found);

      for (const oldest of this.#entries.keys()) {
        if (this.#entries.size <= MAX_ENTRIES) {
          break;
        }
        this.#entries.delete(oldest);
      }
    }

    return found;
  }
}
