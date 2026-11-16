import type { RunFactsPort } from '@runs/application/ports/run-facts.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { HandBackTaskCommand } from '@work/application/commands/hand-back-task.command';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import type { TaskDispatching } from '@work/application/services/dispatch-task.service';
import { handedToRun } from '@work/application/services/handed-to-run';
import type { LineLoader } from '@work/application/services/line-loader.service';
import type { Takeover } from '@work/domain/entities/takeover.entity';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { Placement } from '@work/domain/services/placement';
import { CheckoutHead } from '@work/domain/value-objects/checkout-head.vo';
import { handBackOf } from '@work/domain/value-objects/hand-back';
import type { Station } from '@work/domain/value-objects/station.vo';
import { takeoverVerdictOf } from '@work/domain/value-objects/takeover-verdict';
import type { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TurnHeads } from '@work/domain/value-objects/turn-heads.vo';

export class HandBackTaskHandler implements CommandHandlerPort<
  HandBackTaskCommand,
  void
> {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: LineLoader,
    private readonly placements: TaskPlacementsPort,
    private readonly facts: RunFactsPort,
    private readonly transaction: TransactionPort,
    private readonly dispatch: TaskDispatching,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: HandBackTaskCommand): Promise<void> {
    try {
      await this.transaction.inTransaction(() => this.handBack(command));
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async handBack(command: HandBackTaskCommand): Promise<void> {
    const by = UserId.of(command.viewerId);
    const task = await this.tasks.find(TaskId.of(command.taskId));

    if (!task) {
      throw new UnknownTaskError(command.taskId);
    }

    const line = await this.lines.atStation(
      command.teamId,
      task.stationId,
      command.viewerId,
      () => new UnknownTaskError(command.taskId),
    );
    const next = handBackOf(command.next);
    const to = command.stationId ? StationId.of(command.stationId) : null;
    const turnHeads = task.openTakeover
      ? await this.headsOf(task.openTakeover)
      : [];

    const handedBack = task.handBack({
      by,
      line,
      next,
      to,
      rank: await this.rankAt(task.handBackDestination(line, next, to)),
      verdict: command.verdict ? takeoverVerdictOf(command.verdict) : null,
      summary: command.summary,
      turnHeads,
      at: this.clock.now(),
    });

    await this.tasks.save(await handedToRun(this.dispatch, handedBack, line));
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

  private async headsOf(takeover: Takeover): Promise<readonly TurnHeads[]> {
    const facts = await this.facts.of(takeover.turns);

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
}
