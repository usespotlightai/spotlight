import type { ClockPort } from '@application/ports/clock.port';
import type { HandoverPort } from '@application/ports/handover.port';
import type { TaskDispatchPort } from '@application/ports/task-dispatch.port';
import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { Run } from '@domain/aggregates/run.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { HandoverFor } from '@domain/services/handover-for';
import type { Declaration } from '@domain/value-objects/declaration.vo';
import type { Handover } from '@domain/value-objects/handover.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskNote } from '@domain/value-objects/task-note.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';

export class HandOver implements HandoverPort {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: AssemblyLineRepository,
    private readonly dispatch: TaskDispatchPort,
    private readonly clock: ClockPort,
  ) {}

  async handOver(run: Run, declared?: Declaration | null): Promise<void> {
    if (!run.taskId) {
      return;
    }

    const task = await this.tasks.find(run.taskId);

    if (!task?.currentRunId?.equals(run.id)) {
      return;
    }

    const line = await this.lines.holding(task.stationId);

    const handover = this.decided(run, declared, line, task);

    await this.tasks.save(await this.applied(handover, task, line));
  }

  private decided(
    run: Run,
    declared: Declaration | null | undefined,
    line: AssemblyLine | null,
    task: Task,
  ): Handover {
    if (run.abandoned) {
      return HandoverFor.exhausted(run.attempt);
    }

    if (declared && !run.result?.failed) {
      return HandoverFor.declared(declared, line?.stations ?? [], task.stationId);
    }

    return HandoverFor.outcome(run.result);
  }

  private async applied(
    handover: Handover,
    task: Task,
    line: AssemblyLine | null,
  ): Promise<Task> {
    const standing = line?.stations.find((each) =>
      each.id.equals(task.stationId),
    );

    const note = TaskNote.of({
      station: standing?.name ?? StationName.of('Unknown'),
      body: handover.body,
      at: this.clock.now(),
    });

    if (handover.kind === 'review' || !handover.stationId || !line) {
      return task.askedAbout(note);
    }

    const arriving = handover.stationId;
    const behind = await this.tasks.standingAt(arriving);
    const last = behind[behind.length - 1] ?? null;

    const passed = task.passedTo(
      arriving,
      TaskRank.between(last ? last.rank : null, null),
      note,
    );

    const station = line.stations.find((each) => each.id.equals(arriving));
    const runId = station
      ? await this.dispatch.dispatch({
          task: passed,
          station,
          stations: line.stations,
        })
      : null;

    return runId ? passed.handedTo(runId) : passed;
  }
}
