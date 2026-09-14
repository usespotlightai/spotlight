import type { RunnerId } from '@domain/value-objects/runner-id.vo';

export interface KeptWorkspace {
  readonly taskId: string;
  readonly stationId: string;
}

export const KEPT_WORKSPACE_READER = Symbol('KEPT_WORKSPACE_READER');

export interface KeptWorkspaceReaderPort {
  listFor(runnerId: RunnerId): Promise<KeptWorkspace[]>;
}
