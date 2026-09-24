import type { CatalogInputValues } from '@catalog/application/contracts/catalog.contract';
import type { CatalogTool } from '@catalog/domain/entities/catalog-item.entity';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const CATALOG_SERVICE = Symbol('CATALOG_SERVICE');

export interface CatalogCallFor {
  readonly workspaceId: WorkspaceId;
  readonly runId: RunId;
}

export interface CatalogServicePort {
  call(
    tool: CatalogTool,
    inputs: CatalogInputValues,
    on: CatalogCallFor,
  ): Promise<unknown>;
}
