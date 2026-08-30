import type { RunnerId } from '@domain/value-objects/runner-id.vo';

export interface KeptWorkspace {
  readonly taskId: string;
  readonly stationId: string;
}

export const KEPT_WORKSPACE_READER = Symbol('KEPT_WORKSPACE_READER');

export interface KeptWorkspaceReaderPort {
  /** Tasks pinned to this runner with a conversation still worth taking up. */
  listFor(runnerId: RunnerId): Promise<KeptWorkspace[]>;
}
