import type { Egress } from '@runners/domain/aggregates/egress.aggregate';
import type { EgressId } from '@runners/domain/value-objects/egress-id.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface EgressRepository {
  add(egress: Egress): Promise<void>;

  save(egress: Egress): Promise<void>;

  find(id: EgressId): Promise<Egress | null>;

  findToName(id: EgressId): Promise<Egress | null>;

  findToRetire(id: EgressId): Promise<Egress | null>;

  findByTokenHash(hash: TokenHash): Promise<Egress | null>;

  inWorkspace(workspaceId: WorkspaceId): Promise<readonly Egress[]>;
}
