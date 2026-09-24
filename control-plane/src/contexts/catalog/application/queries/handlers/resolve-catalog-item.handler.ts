import type {
  CatalogItemDto,
  CatalogResolution,
} from '@catalog/application/dto/catalog-item.dto';
import type { ResolveCatalogItemQuery } from '@catalog/application/queries/resolve-catalog-item.query';
import { CatalogProblems } from '@catalog/application/rendering/catalog-problems';
import type { CatalogItem } from '@catalog/domain/entities/catalog-item.entity';
import { InvalidCatalogEntryError } from '@catalog/domain/exceptions/invalid-catalog-entry.error';
import type { CatalogRepository } from '@catalog/domain/repositories/catalog.repository';
import type { WorkspacePlanRepository } from '@catalog/domain/repositories/workspace-plan.repository';
import { entitlementTo } from '@catalog/domain/services/entitlement';
import { newestAdmitted } from '@catalog/domain/services/newest-admitted';
import { CatalogName } from '@catalog/domain/value-objects/catalog-name.vo';
import { VersionConstraint } from '@catalog/domain/value-objects/version-constraint.vo';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const itemDto = (
  item: CatalogItem,
  constraint: VersionConstraint,
): CatalogItemDto => ({
  kind: item.kind,
  id: item.id.value,
  name: item.listing.name.value,
  version: item.listing.version.value,
  constraint: constraint.value,
  plan: item.listing.needs.value,
  description: item.listing.description,
  tools: item.kind === 'skill' ? item.brings.map((each) => each.value) : [],
});

const attempted = <T>(
  read: () => T,
  refusals: InvalidCatalogEntryError[],
): T | null => {
  try {
    return read();
  } catch (error) {
    if (error instanceof InvalidCatalogEntryError) {
      refusals.push(error);
      return null;
    }

    throw error;
  }
};

export class ResolveCatalogItemHandler
  implements QueryHandlerPort<ResolveCatalogItemQuery, CatalogResolution | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly catalog: CatalogRepository,
    private readonly plans: WorkspacePlanRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    query: ResolveCatalogItemQuery,
  ): Promise<CatalogResolution | null> {
    try {
      const cleared = await this.access.clearanceIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );

      if (!cleared) {
        return null;
      }

      const refusals: InvalidCatalogEntryError[] = [];
      const name = attempted(() => CatalogName.of(query.name), refusals);
      const constraint = attempted(
        () => VersionConstraint.of(query.version),
        refusals,
      );

      if (!name || !constraint) {
        return {
          outcome: 'invalid',
          problems: refusals.map((each) =>
            CatalogProblems.invalid(query.kind, each),
          ),
        };
      }

      const admission = newestAdmitted(
        query.kind,
        name,
        this.catalog.versionsOf(query.kind, name),
        constraint,
      );

      if (!admission.found) {
        return { outcome: 'unmatched', because: admission.because };
      }

      const entitlement = entitlementTo(
        admission.item,
        await this.plans.of(cleared.workspaceId),
        this.clock.now(),
      );

      return entitlement.entitled
        ? { outcome: 'resolved', item: itemDto(admission.item, constraint) }
        : { outcome: 'not-entitled', because: entitlement.because };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
