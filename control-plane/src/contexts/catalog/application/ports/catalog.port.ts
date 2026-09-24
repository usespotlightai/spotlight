import type {
  CatalogCallAnswer,
  CatalogGiving,
  CatalogInputValues,
  CatalogNamed,
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
  givenTo(
    workspaceId: WorkspaceId,
    named: CatalogNamed,
  ): Promise<CatalogGiving>;

  call(request: CatalogCallRequest): Promise<CatalogCallAnswer>;
}
