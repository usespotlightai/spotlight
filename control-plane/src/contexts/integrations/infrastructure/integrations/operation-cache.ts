import type { DescribedDocumentRepository } from '@integrations/domain/repositories/described-document.repository';
import type { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import type { DescribedOperation } from '@integrations/domain/value-objects/described-operation.vo';

const MAX_ENTRIES = 2000;

export class OperationCache {
  readonly #entries = new Map<string, DescribedOperation>();

  constructor(private readonly documents: DescribedDocumentRepository) {}

  async of(
    hash: ContentHash,
    name: string,
  ): Promise<DescribedOperation | null> {
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
