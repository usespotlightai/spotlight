import type {
  CatalogItem,
  CatalogKind,
} from '@catalog/domain/entities/catalog-item.entity';
import type { CatalogItemId } from '@catalog/domain/value-objects/catalog-item-id.vo';
import type { CatalogName } from '@catalog/domain/value-objects/catalog-name.vo';

export interface CatalogRepository {
  versionsOf(kind: CatalogKind, name: CatalogName): readonly CatalogItem[];
  find(id: CatalogItemId): CatalogItem | null;
}
