import type { CatalogKind } from '@catalog/domain/entities/catalog-item.entity';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ResolveCatalogItemQuery {
  constructor(
    readonly workspaceId: string,
    readonly kind: CatalogKind,
    readonly name: string,
    readonly version: string,
    readonly principal: Principal,
  ) {}
}
