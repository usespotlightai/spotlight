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
    withHash: (hash) => Promise.resolve(withHash(hash.value)),
    save: (document) => {
      if (!withHash(document.hash.value)) {
        stored.push(document);
      }

      return Promise.resolve();
    },
  };
};

export const operationsContaining = (
  ...documents: SpecDocument[]
): OperationCache =>
  new OperationCache({
    operation: (hash, name) =>
      Promise.resolve(
        documents.find((each) => each.hash.equals(hash))?.operation(name) ??
          null,
      ),
  });
