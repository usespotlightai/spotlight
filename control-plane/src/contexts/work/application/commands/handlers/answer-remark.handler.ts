import type { RemarksPort } from '@github/application/ports/remarks.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { AnswerRemarkCommand } from '@work/application/commands/answer-remark.command';
import type { RunLoader } from '@work/application/services/run-loader.service';
import { NoRepositoryError } from '@work/domain/exceptions/no-repository.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { RemarkHandle } from '@work/domain/value-objects/remark-handle.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';

export class AnswerRemarkHandler
  implements CommandHandlerPort<AnswerRemarkCommand, void>
{
  constructor(
    private readonly runs: RunLoader,
    private readonly tasks: TaskRepository,
    private readonly lines: LineRepository,
    private readonly remarks: RemarksPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: AnswerRemarkCommand): Promise<void> {
    try {
      const { run, task } = await this.runs.forRunner(
        command.runId,
        command.runnerId,
      );

      run.mayReachBeyondItself('answer a remark');

      if (!task) {
        throw new NoRepositoryError();
      }

      const at = RemarkHandle.of(command.handle);
      const answering = task.remarkAnswerableFrom(run.id, run.stationId, at);
      const line = await this.lines.holding(task.stationId);
      // Post to the host before you record the answer. Then the trail never holds an answer that the pull request does not have.
      await this.remarks.answer({
        workspaceId: task.workspaceId,
        repository: answering.repository,
        pullRequest: answering.pullRequest,
        remark: answering.remark.value,
        body: command.body,
        resolve: command.resolve,
      });

      await this.tasks.save(
        task.repliedTo(run.id, run.stationId, at, {
          station:
            line?.stationAt(task.stationId)?.name ?? StationName.unknown(),
          body: TaskNoteBody.of(command.body),
          at: this.clock.now(),
          voice: Voice.station(run.id),
        }),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
