import type { CatalogKind } from '@catalog/domain/entities/catalog-item.entity';
import type { InvalidCatalogEntryError } from '@catalog/domain/exceptions/invalid-catalog-entry.error';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export const CatalogProblems = {
  invalid(kind: CatalogKind, error: InvalidCatalogEntryError) {
    return ConfigurationProblem.of({
      path: `catalog/${kind}s`,
      at: FieldPath.of([error.field]),
      reason: error.because,
    });
  },
};
