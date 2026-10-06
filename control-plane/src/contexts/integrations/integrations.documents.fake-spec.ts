import type { DescribedDocument } from '@integrations/domain/aggregates/described-document.aggregate';
import type { DescribedDocumentRepository } from '@integrations/domain/repositories/described-document.repository';
import { OperationCache } from '@integrations/infrastructure/integrations/operation-cache';

export const documentsHolding = (
  ...held: DescribedDocument[]
): DescribedDocumentRepository & { readonly kept: DescribedDocument[] } => {
  const kept = [...held];
  const withHash = (hash: string) =>
    kept.find((each) => each.hash.value === hash) ?? null;

  return {
    kept,
    withHash: async (hash) => withHash(hash.value),
    operation: async (hash, name) =>
      withHash(hash.value)?.operation(name) ?? null,
    keep: async (document) => {
      if (!withHash(document.hash.value)) {
        kept.push(document);
      }
    },
  };
};

export const operationsHolding = (
  ...held: DescribedDocument[]
): OperationCache => new OperationCache(documentsHolding(...held));
