import type {
  RunGrantsPort,
  RunHoldDto,
} from '@secrets/application/ports/run-grants.port';
import type { RunGrantsKept } from '@secrets/application/services/run-grants-kept';
import { RunHold } from '@secrets/domain/value-objects/run-hold.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RunGrantEndings implements RunGrantsPort {
  constructor(
    private readonly kept: RunGrantsKept,
    private readonly clock: ClockPort,
  ) {}

  holdLost(lost: RunHoldDto): Promise<void> {
    const run = heldRun(lost);

    return this.kept.changed(run, (held) => held.loseHold(run.hold));
  }

  endedFor(ended: RunHoldDto): Promise<void> {
    return this.kept.changed(heldRun(ended), (held) =>
      held.end(this.clock.now()),
    );
  }
}

const heldRun = (hold: RunHoldDto) => ({
  hold: RunHold.of(RunId.of(hold.runId), hold.attempt),
  workspaceId: WorkspaceId.of(hold.workspaceId),
});
