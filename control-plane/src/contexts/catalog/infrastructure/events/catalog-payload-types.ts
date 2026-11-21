import { CatalogItemId } from '@catalog/domain/value-objects/catalog-item-id.vo';
import { CatalogName } from '@catalog/domain/value-objects/catalog-name.vo';
import { CatalogVersion } from '@catalog/domain/value-objects/catalog-version.vo';
import { VersionConstraint } from '@catalog/domain/value-objects/version-constraint.vo';

export const CATALOG_PAYLOAD_TYPES = [
  CatalogItemId,
  CatalogName,
  CatalogVersion,
  VersionConstraint,
] as const;
