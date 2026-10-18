import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const PROCESSED_EVENTS = Symbol('PROCESSED_EVENTS');

export interface ProcessedEventsPort {
  wasProcessed(workspaceId: WorkspaceId, key: string): Promise<boolean>;

  markProcessed(
    workspaceId: WorkspaceId,
    key: string,
    at: Date,
  ): Promise<boolean>;

  purgeBefore(before: Date, max: number): Promise<number>;
}
