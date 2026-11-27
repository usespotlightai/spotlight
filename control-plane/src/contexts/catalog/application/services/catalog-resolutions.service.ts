import type {
  CatalogRequest,
  ResolvedItems,
} from '@catalog/application/contracts/catalog.contract';
import { CatalogShapeMapper } from '@catalog/application/mappers/catalog-shape.mapper';
import type { CatalogResolutionsPort } from '@catalog/application/ports/catalog.port';
import type { CatalogItems } from '@catalog/domain/repositories/catalog-items.repository';
import { resolveItems } from '@catalog/domain/services/catalog-resolution';

export class CatalogResolutions implements CatalogResolutionsPort {
  constructor(private readonly catalog: CatalogItems) {}

  resolve(request: CatalogRequest): Promise<ResolvedItems> {
    const resolved = resolveItems(request, this.catalog);

    return Promise.resolve({
      tools: resolved.tools.map(CatalogShapeMapper.toTool),
      skills: resolved.skills.map(CatalogShapeMapper.toSkill),
      denied: resolved.denied.map(CatalogShapeMapper.toDenial),
    });
  }
}
