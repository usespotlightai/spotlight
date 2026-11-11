import type { NetworkCall } from '@runs/domain/aggregates/network-call.aggregate';
import type { NetworkCallId } from '@runs/domain/value-objects/network-call-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const NETWORK_CALL_REPOSITORY = Symbol('NETWORK_CALL_REPOSITORY');

export interface NetworkCallRepository {
  add(call: NetworkCall): Promise<void>;

  save(call: NetworkCall): Promise<void>;

  find(id: NetworkCallId): Promise<NetworkCall | null>;

  expiringBy(now: Date, max: number): Promise<readonly NetworkCall[]>;

  completedBy(at: Date, max: number): Promise<readonly NetworkCall[]>;

  // Must lock the call it returns until the transaction ends, skipping locked calls.
  nextWaiting(workspaceId: WorkspaceId, now: Date): Promise<NetworkCall | null>;
}
