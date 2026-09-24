import type {
  Holder,
  HoldingsPort,
} from '@identity/application/ports/holdings.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORKSPACE_HOLDINGS = Symbol('WORKSPACE_HOLDINGS');

export type WorkspaceHolder = Holder<WorkspaceId>;

export type WorkspaceHoldingsPort = HoldingsPort<WorkspaceId>;
