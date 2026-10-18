import type {
  CatalogItem,
  CatalogKind,
} from '@catalog/domain/entities/catalog-item.entity';
import type { CatalogRepository } from '@catalog/domain/repositories/catalog.repository';
import { catalogProblem } from '@catalog/domain/services/catalog-consistency';
import type { CatalogItemId } from '@catalog/domain/value-objects/catalog-item-id.vo';
import type { CatalogName } from '@catalog/domain/value-objects/catalog-name.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export class StaticCatalog implements CatalogRepository {
  constructor(private readonly items: readonly CatalogItem[]) {
    const problem = catalogProblem(items);

    if (problem) {
      throw new InconsistentStateError('catalog', problem);
    }
  }

  versionsOf(kind: CatalogKind, name: CatalogName): readonly CatalogItem[] {
    return this.items.filter(
      (each) => each.kind === kind && each.metadata.name.equals(name),
    );
  }

  find(id: CatalogItemId): CatalogItem | null {
    return this.items.find((each) => each.id.equals(id)) ?? null;
  }
}
