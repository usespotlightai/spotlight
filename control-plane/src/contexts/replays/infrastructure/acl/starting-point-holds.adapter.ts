import type { StartingPointHoldsPort } from '@replays/application/ports/starting-point-holds.port';
import type { StartingPointHoldsPort as RunsStartingPointHoldsPort } from '@runs/application/ports/starting-point-holds.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class StartingPointHolds implements StartingPointHoldsPort {
  constructor(private readonly holds: RunsStartingPointHoldsPort) {}

  hold(
    holder: string,
    workspaceId: WorkspaceId,
    runs: readonly RunId[],
  ): Promise<void> {
    return this.holds.hold(
      holder,
      workspaceId.value,
      runs.map((each) => each.value),
    );
  }

  release(holder: string): Promise<void> {
    return this.holds.release(holder);
  }
}
