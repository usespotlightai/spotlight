import type { RunFactsPort } from '@runs/application/ports/run-facts.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type {
  TakenOver,
  TakeOverTaskCommand,
} from '@work/application/commands/take-over-task.command';
import type { TaskDispatching } from '@work/application/services/dispatch-task.service';
import { handedToRun } from '@work/application/services/handed-to-run';
import type { LineLoader } from '@work/application/services/line-loader.service';
import type { WorkAccess } from '@work/application/services/work-access.service';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { TakeoverId } from '@work/domain/value-objects/takeover-id.vo';
import { takeoverVerdictOf } from '@work/domain/value-objects/takeover-verdict';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';

export class TakeOverTaskHandler implements CommandHandlerPort<
  TakeOverTaskCommand,
  TakenOver
> {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: LineLoader,
    private readonly access: WorkAccess,
    private readonly facts: RunFactsPort,
    private readonly transaction: TransactionPort,
    private readonly dispatch: TaskDispatching,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: TakeOverTaskCommand): Promise<TakenOver> {
    try {
      return await this.transaction.inTransaction(() => this.takeOver(command));
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async takeOver(command: TakeOverTaskCommand): Promise<TakenOver> {
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
    const members = await this.access.membersOf(line.teamId);

    if (!members) {
      throw new UnknownTaskError(command.taskId);
    }

    const at = this.clock.now();
    const id = TakeoverId.of(this.ids.generate());
    const taken = task.takeOver({
      id,
      by,
      members,
      line,
      verdict: command.verdict ? takeoverVerdictOf(command.verdict) : null,
      currentRunStarted: await this.started(task.currentRunId),
      at,
    });
    const body = command.body?.trim();
    const asked = body
      ? taken.addMessage(
          {
            line,
            body: TaskNoteBody.fromInput(body),
            at,
            voice: Voice.person(by),
          },
          taken.stationId,
        )
      : taken;
    const saved = await handedToRun(this.dispatch, asked, line);

    await this.tasks.save(saved);

    return {
      takeoverId: id.value,
      runId: saved.currentRunId?.value ?? null,
    };
  }

  private async started(runId: RunId | null): Promise<boolean> {
    if (!runId) {
      return false;
    }

    const [facts] = await this.facts.of([runId]);

    return facts?.started ?? false;
  }
}
