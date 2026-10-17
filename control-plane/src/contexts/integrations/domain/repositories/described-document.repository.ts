import type { DescribedDocument } from '@integrations/domain/aggregates/described-document.aggregate';
import type { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import type { DescribedOperation } from '@integrations/domain/value-objects/described-operation.vo';

export const DESCRIBED_DOCUMENTS = Symbol('DESCRIBED_DOCUMENTS');

export interface DescribedDocumentRepository {
  withHash(hash: ContentHash): Promise<DescribedDocument | null>;

  operation(
    hash: ContentHash,
    name: string,
  ): Promise<DescribedOperation | null>;

  save(document: DescribedDocument): Promise<void>;
}
