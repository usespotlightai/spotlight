import type { SpecDocument } from '@integrations/domain/aggregates/spec-document.aggregate';
import type { SpecDocumentRepository } from '@integrations/domain/repositories/spec-document.repository';
import { OperationCache } from '@integrations/infrastructure/integrations/operation-cache';

export const documentsContaining = (
  ...documents: SpecDocument[]
): SpecDocumentRepository & { readonly stored: SpecDocument[] } => {
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
  ...documents: SpecDocument[]
): OperationCache => new OperationCache(documentsContaining(...documents));
