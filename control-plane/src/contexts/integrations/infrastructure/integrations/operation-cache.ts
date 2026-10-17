import type { DescribedDocumentRepository } from '@integrations/domain/repositories/described-document.repository';
import type { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import type { DescribedOperation } from '@integrations/domain/value-objects/described-operation.vo';

const MAX_HELD = 2000;

export class OperationCache {
  readonly #held = new Map<string, DescribedOperation>();

  constructor(private readonly documents: DescribedDocumentRepository) {}

  async of(
    hash: ContentHash,
    name: string,
  ): Promise<DescribedOperation | null> {
    const key = `${hash.value}:${name}`;
    const held = this.#held.get(key);

    if (held) {
      this.#held.delete(key);
      this.#held.set(key, held);

      return held;
    }

    const found = await this.documents.operation(hash, name);

    if (found) {
      this.#held.set(key, found);

      for (const oldest of this.#held.keys()) {
        if (this.#held.size <= MAX_HELD) {
          break;
        }
        this.#held.delete(oldest);
      }
    }

    return found;
  }
}
