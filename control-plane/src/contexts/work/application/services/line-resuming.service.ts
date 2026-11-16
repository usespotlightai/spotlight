import type { RunFactsPort } from '@runs/application/ports/run-facts.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { CheckoutHead } from '@shared-kernel/domain/value-objects/checkout-head.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import type { TaskDispatching } from '@work/application/services/dispatch-task.service';
import { handedToRun } from '@work/application/services/handed-to-run';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { Hold } from '@work/domain/entities/hold.entity';
import { Placement } from '@work/domain/services/placement';
import type { HoldEnd } from '@work/domain/value-objects/hold-end';
import type { HoldVerdict } from '@work/domain/value-objects/hold-verdict';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import type { Station } from '@work/domain/value-objects/station.vo';
import type { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TurnHeads } from '@work/domain/value-objects/turn-heads.vo';

export interface Resuming {
  readonly by: UserId;
  readonly next: HoldEnd;
  readonly to: StationId | null;
  readonly verdict: HoldVerdict | null;
  readonly summary: string | null;
  readonly endingTurn: RunId | null;
}

export class LineResuming {
  constructor(
    private readonly placements: TaskPlacementsPort,
    private readonly facts: RunFactsPort,
    private readonly dispatch: TaskDispatching,
    private readonly clock: ClockPort,
  ) {}

  async resumed(task: Task, line: LineMap, input: Resuming): Promise<Task> {
    const at = this.clock.now();
    const left = input.endingTurn ? task.leaveRun(input.endingTurn, at) : task;
    const resumed = left.resumeLine({
      by: input.by,
      line,
      next: input.next,
      to: input.to,
      rank: await this.rankAt(
        left.resumeDestination(line, input.next, input.to),
      ),
      verdict: input.verdict,
      summary: input.summary,
      turnHeads: await this.turnHeads(left.openHold),
      at,
      run: input.endingTurn,
    });

    return handedToRun(this.dispatch, resumed, line);
  }

  async turnHeads(hold: Hold | null): Promise<readonly TurnHeads[]> {
    if (!hold) {
      return [];
    }

    const facts = await this.facts.of(hold.turns);

    return facts.map((each) =>
      TurnHeads.of({
        runId: each.runId,
        started: (each.startedFrom?.checkouts ?? []).map((head) =>
          CheckoutHead.rehydrate(head),
        ),
        ended: each.endHeads.map((head) => CheckoutHead.rehydrate(head)),
      }),
    );
  }

  private async rankAt(into: Station | null): Promise<TaskRank | null> {
    if (!into) {
      return null;
    }

    const ranks = (await this.placements.placementsAt(into.id)).map(
      (each) => each.rank,
    );

    return Placement.entering('passed-on', ranks);
  }
}
