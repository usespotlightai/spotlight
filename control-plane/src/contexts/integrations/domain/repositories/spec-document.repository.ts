import type { SpecDocument } from '@integrations/domain/aggregates/spec-document.aggregate';
import type { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';

export const SPEC_DOCUMENTS = Symbol('SPEC_DOCUMENTS');

export interface SpecDocumentRepository {
  withHash(hash: ContentHash): Promise<SpecDocument | null>;

  save(document: SpecDocument): Promise<void>;
}
