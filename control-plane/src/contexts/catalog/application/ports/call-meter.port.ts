import type { MeteredCall } from '@catalog/domain/value-objects/metered-call.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const CALL_METER = Symbol('CALL_METER');

export interface CallMeterPort {
  record(call: MeteredCall): Promise<void>;
  deleteForWorkspace(workspaceId: WorkspaceId): Promise<void>;
}
