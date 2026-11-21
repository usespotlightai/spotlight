import type { CatalogCallResult } from '@catalog/application/contracts/catalog.contract';
import { CatalogShapeMapper } from '@catalog/application/mappers/catalog-shape.mapper';
import type { CatalogServicePort } from '@catalog/application/ports/catalog-service.port';
import type {
  CatalogCallRequest,
  CatalogCallsPort,
} from '@catalog/application/ports/catalog.port';
import type { CatalogItems } from '@catalog/domain/repositories/catalog-items.repository';
import { resolveItem } from '@catalog/domain/services/catalog-resolution';

export class CatalogCalls implements CatalogCallsPort {
  constructor(
    private readonly catalog: CatalogItems,
    private readonly service: CatalogServicePort,
  ) {}

  async call(request: CatalogCallRequest): Promise<CatalogCallResult> {
    const result = resolveItem(request.id, 'tool', this.catalog);

    if (!result.resolved) {
      return {
        kind: 'denied',
        denial: CatalogShapeMapper.toDenial(result.denial),
      };
    }

    const output = await this.service.call(result.item, request.inputs, {
      workspaceId: request.workspaceId,
      runId: request.runId,
    });

    return { kind: 'answered', output };
  }
}
