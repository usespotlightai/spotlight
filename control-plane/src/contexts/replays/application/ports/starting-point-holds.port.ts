import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const STARTING_POINT_HOLDS = Symbol('REPLAYS_STARTING_POINT_HOLDS');

export interface StartingPointHoldsPort {
  hold(
    holder: string,
    workspaceId: WorkspaceId,
    runs: readonly RunId[],
  ): Promise<void>;

  release(holder: string): Promise<void>;
}
