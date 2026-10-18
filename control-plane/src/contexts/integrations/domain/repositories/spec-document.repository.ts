import type { SpecDocument } from '@integrations/domain/aggregates/spec-document.aggregate';
import type { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import type { SpecOperation } from '@integrations/domain/value-objects/spec-operation.vo';

export const SPEC_DOCUMENTS = Symbol('SPEC_DOCUMENTS');

export interface SpecDocumentRepository {
  withHash(hash: ContentHash): Promise<SpecDocument | null>;

  operation(hash: ContentHash, name: string): Promise<SpecOperation | null>;

  save(document: SpecDocument): Promise<void>;
}
