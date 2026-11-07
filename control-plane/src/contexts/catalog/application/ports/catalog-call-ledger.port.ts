import type { CatalogCall } from '@catalog/domain/value-objects/catalog-call.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const CATALOG_CALL_LEDGER = Symbol('CATALOG_CALL_LEDGER');

export interface CatalogCallLedgerPort {
  record(call: CatalogCall): Promise<void>;
  deleteForWorkspace(workspaceId: WorkspaceId): Promise<void>;
}
