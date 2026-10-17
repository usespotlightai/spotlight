import type { DescribedDocument } from '@integrations/domain/aggregates/described-document.aggregate';
import type { DescribedDocumentRepository } from '@integrations/domain/repositories/described-document.repository';
import { OperationCache } from '@integrations/infrastructure/integrations/operation-cache';

export const documentsContaining = (
  ...documents: DescribedDocument[]
): DescribedDocumentRepository & { readonly stored: DescribedDocument[] } => {
  const stored = [...documents];
  const withHash = (hash: string) =>
    stored.find((each) => each.hash.value === hash) ?? null;

  return {
    stored,
    withHash: async (hash) => withHash(hash.value),
    operation: async (hash, name) =>
      withHash(hash.value)?.operation(name) ?? null,
    save: async (document) => {
      if (!withHash(document.hash.value)) {
        stored.push(document);
      }
    },
  };
};

export const operationsContaining = (
  ...documents: DescribedDocument[]
): OperationCache => new OperationCache(documentsContaining(...documents));
