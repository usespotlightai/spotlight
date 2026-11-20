import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORKSPACES = Symbol('WORKSPACES');

export interface WorkspaceListing {
  readonly id: WorkspaceId;
  readonly slug: string;
  readonly name: string;
  readonly createdAt: Date;
  readonly memberCount: number;
}

export interface WorkspaceListingRequest {
  readonly after: string | null;
  readonly limit: number;
  readonly createdAfter: Date | null;
}

export interface WorkspaceListingPage {
  readonly items: readonly WorkspaceListing[];
  readonly next: string | null;
}

// Every workspace of the deployment, whoever asks. Use it only for callers with the admin token.
export interface WorkspacesPort {
  list(request: WorkspaceListingRequest): Promise<WorkspaceListingPage>;

  find(workspaceId: WorkspaceId): Promise<WorkspaceListing | null>;
}
