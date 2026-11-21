import type {
  CatalogItemDto,
  CatalogResolution,
} from '@catalog/application/dto/catalog-item.dto';
import type { ResolveCatalogItemQuery } from '@catalog/application/queries/resolve-catalog-item.query';
import { CatalogProblems } from '@catalog/application/rendering/catalog-problems';
import type { CatalogItem } from '@catalog/domain/entities/catalog-item.entity';
import { InvalidCatalogEntryError } from '@catalog/domain/exceptions/invalid-catalog-entry.error';
import type { CatalogItems } from '@catalog/domain/repositories/catalog-items.repository';
import { newestMatching } from '@catalog/domain/services/newest-matching';
import { CatalogName } from '@catalog/domain/value-objects/catalog-name.vo';
import { VersionConstraint } from '@catalog/domain/value-objects/version-constraint.vo';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const itemDto = (
  item: CatalogItem,
  constraint: VersionConstraint,
): CatalogItemDto => ({
  kind: item.kind,
  id: item.id.value,
  name: item.metadata.name.value,
  version: item.metadata.version.value,
  constraint: constraint.value,
  description: item.metadata.description,
  tools: item.kind === 'skill' ? item.tools.map((each) => each.value) : [],
});

const attempted = <T>(
  read: () => T,
  problems: InvalidCatalogEntryError[],
): T | null => {
  try {
    return read();
  } catch (error) {
    if (error instanceof InvalidCatalogEntryError) {
      problems.push(error);
      return null;
    }

    throw error;
  }
};

export class ResolveCatalogItemHandler implements QueryHandlerPort<
  ResolveCatalogItemQuery,
  CatalogResolution | null
> {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly catalog: CatalogItems,
  ) {}

  async execute(
    query: ResolveCatalogItemQuery,
  ): Promise<CatalogResolution | null> {
    try {
      const permissions = await this.access.permissionsIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );

      if (!permissions) {
        return null;
      }

      const problems: InvalidCatalogEntryError[] = [];
      const name = attempted(() => CatalogName.of(query.name), problems);
      const constraint = attempted(
        () => VersionConstraint.of(query.version),
        problems,
      );

      if (!name || !constraint) {
        return {
          outcome: 'invalid',
          problems: problems.map((each) =>
            CatalogProblems.invalid(query.kind, each),
          ),
        };
      }

      const match = newestMatching(
        query.kind,
        name,
        this.catalog.versionsOf(query.kind, name),
        constraint,
      );

      if (!match.found) {
        return { outcome: 'unmatched', because: match.because };
      }

      return { outcome: 'resolved', item: itemDto(match.item, constraint) };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
