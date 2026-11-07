import type { NetworkCall } from '@runs/domain/aggregates/network-call.aggregate';
import type { CallingHost } from '@runs/domain/value-objects/calling-host.vo';
import type { NetworkCallId } from '@runs/domain/value-objects/network-call-id.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface NetworkCallRepository {
  add(call: NetworkCall): Promise<void>;

  save(call: NetworkCall): Promise<void>;

  find(id: NetworkCallId): Promise<NetworkCall | null>;

  expiringBy(now: Date, max: number): Promise<readonly NetworkCall[]>;

  completedBy(at: Date, max: number): Promise<readonly NetworkCall[]>;

  // Must be atomic: two hosts must never claim the same call.
  claimNext(
    workspaceId: WorkspaceId,
    by: CallingHost,
    now: Date,
    secretsToken: TokenHash,
  ): Promise<NetworkCall | null>;
}
