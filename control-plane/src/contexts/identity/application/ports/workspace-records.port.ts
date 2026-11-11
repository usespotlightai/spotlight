import type {
  WorkspaceListing,
  WorkspaceProfile,
} from '@identity/application/ports/workspace-reader.port';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface TeamSummary {
  readonly id: string;
  readonly name: string;
  readonly avatarDigest: string | null;
}

export interface WorkspaceRecordsPort {
  idForSlug(slug: string): Promise<string | null>;

  slugOf(workspaceId: string): Promise<string | null>;

  profileOf(workspaceId: string): Promise<WorkspaceProfile | null>;

  identifyTeam(
    slug: string,
    teamKey: string,
  ): Promise<{ workspaceId: string; teamId: string } | null>;

  listingsOf(person: UserId): Promise<WorkspaceListing[]>;

  teamsIn(workspaceId: WorkspaceId): Promise<TeamSummary[]>;

  avatarDigestOf(workspaceId: WorkspaceId): Promise<string | null>;
}
