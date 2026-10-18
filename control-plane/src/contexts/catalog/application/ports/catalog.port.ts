import type {
  CatalogCallResult,
  CatalogInputValues,
  CatalogRequest,
  EntitledItems,
} from '@catalog/application/contracts/catalog.contract';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const CATALOG = Symbol('CATALOG');

export interface CatalogCallRequest {
  readonly workspaceId: WorkspaceId;
  readonly runId: RunId;
  readonly id: string;
  readonly inputs: CatalogInputValues;
}

export interface CatalogPort {
  entitledTo(
    workspaceId: WorkspaceId,
    request: CatalogRequest,
  ): Promise<EntitledItems>;

  call(request: CatalogCallRequest): Promise<CatalogCallResult>;
}
