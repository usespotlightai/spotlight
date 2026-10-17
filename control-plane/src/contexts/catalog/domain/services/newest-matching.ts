import type {
  CatalogItem,
  CatalogKind,
} from '@catalog/domain/entities/catalog-item.entity';
import type { CatalogName } from '@catalog/domain/value-objects/catalog-name.vo';
import type { VersionConstraint } from '@catalog/domain/value-objects/version-constraint.vo';

export type VersionMatch =
  | { readonly found: true; readonly item: CatalogItem }
  | { readonly found: false; readonly because: string };

export const newestMatching = (
  kind: CatalogKind,
  name: CatalogName,
  versions: readonly CatalogItem[],
  constraint: VersionConstraint,
): VersionMatch => {
  const [newest] = versions
    .filter((each) => constraint.matches(each.listing.version))
    .sort((a, b) => b.listing.version.compare(a.listing.version));

  if (newest) {
    return { found: true, item: newest };
  }

  return {
    found: false,
    because:
      versions.length === 0
        ? `Catalog has no ${kind} named ${name.value}.`
        : `No version of catalog ${kind} ${name.value} matches ${constraint.value}. Available versions: ${versions
            .map((each) => each.listing.version.value)
            .join(', ')}`,
  };
};
