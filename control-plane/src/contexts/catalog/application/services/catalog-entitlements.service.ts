import type {
  CatalogRequest,
  EntitledItems,
} from '@catalog/application/contracts/catalog.contract';
import { CatalogEntitledMapper } from '@catalog/application/mappers/catalog-entitled.mapper';
import type { CatalogEntitlementsPort } from '@catalog/application/ports/catalog.port';
import type { WorkspacePlansPort } from '@catalog/application/ports/workspace-plans.port';
import type { CatalogItems } from '@catalog/domain/services/catalog-items';
import { resolveEntitledFor } from '@catalog/domain/services/entitlement-resolution';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class CatalogEntitlements implements CatalogEntitlementsPort {
  constructor(
    private readonly catalog: CatalogItems,
    private readonly plans: WorkspacePlansPort,
    private readonly clock: ClockPort,
  ) {}

  async entitledTo(
    workspaceId: WorkspaceId,
    request: CatalogRequest,
  ): Promise<EntitledItems> {
    const entitled = resolveEntitledFor(
      request,
      this.catalog,
      await this.plans.of(workspaceId),
      this.clock.now(),
    );

    return {
      tools: entitled.tools.map(CatalogEntitledMapper.toTool),
      skills: entitled.skills.map(CatalogEntitledMapper.toSkill),
      denied: entitled.denied.map(CatalogEntitledMapper.toDenial),
    };
  }
}
