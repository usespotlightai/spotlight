import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { nonEmpty } from '@shared-kernel/domain/non-empty';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { ResumeLineCommand } from '@work/application/commands/resume-line.command';
import { HoldConflictError } from '@work/application/errors/hold-conflict.error';
import type { LineLoader } from '@work/application/services/line-loader.service';
import type { LineResuming } from '@work/application/services/line-resuming.service';
import { nameOf } from '@work/application/services/person-name';
import { HeldForAgentChatError } from '@work/domain/exceptions/held-for-agent-chat.error';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { holdEndOf } from '@work/domain/value-objects/hold-end';
import { holdVerdictOf } from '@work/domain/value-objects/hold-verdict';

export class ResumeLineHandler implements CommandHandlerPort<
  ResumeLineCommand,
  void
> {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: LineLoader,
    private readonly resuming: LineResuming,
    private readonly transaction: TransactionPort,
    private readonly people: PersonReaderPort,
  ) {}

  async execute(command: ResumeLineCommand): Promise<void> {
    try {
      await this.transaction.inTransaction(() => this.resumeLine(command));
    } catch (error) {
      if (error instanceof HeldForAgentChatError) {
        throw new HoldConflictError(
          `An agent chat of ${await nameOf(this.people, error.by)} holds this task. Only they can hand it to the line.`,
        );
      }

      rethrowAsApplicationError(error);
    }
  }

  private async resumeLine(command: ResumeLineCommand): Promise<void> {
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

    await this.tasks.save(
      await this.resuming.resumed(task, line, {
        by: UserId.of(command.viewerId),
        next: holdEndOf(command.next),
        to: nonEmpty(command.stationId)
          ? StationId.of(command.stationId)
          : null,
        verdict: nonEmpty(command.verdict)
          ? holdVerdictOf(command.verdict)
          : null,
        summary: command.summary,
        endingTurn: null,
      }),
    );
  }
}
