import type { AnswerRemarkCommand } from '@application/commands/answer-remark.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { RemarksPort } from '@application/ports/remarks.port';
import type { RunAtHand } from '@application/services/run-at-hand.service';
import { InvalidTaskTransitionError } from '@domain/exceptions/invalid-task-transition.error';
import { NoGitHubInstallationError } from '@domain/exceptions/no-github-installation.error';
import { NoRepositoryError } from '@domain/exceptions/no-repository.error';
import type { LineRepository } from '@domain/repositories/line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import type { WorkspaceConnections } from '@domain/repositories/workspace.repository';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import { RemarkHandle } from '@domain/value-objects/remark-handle.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import { Voice } from '@domain/value-objects/voice.vo';

export class AnswerRemarkHandler
  implements CommandHandlerPort<AnswerRemarkCommand, void>
{
  constructor(
    private readonly held: RunAtHand,
    private readonly tasks: TaskRepository,
    private readonly lines: LineRepository,
    private readonly workspaces: WorkspaceConnections,
    private readonly remarks: RemarksPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: AnswerRemarkCommand): Promise<void> {
    try {
      const { run, task } = await this.held.heldBy(
        command.runId,
        command.runnerId,
      );

      const repository = task?.pullRequest?.repository ?? null;

      if (!task?.pullRequest || !repository) {
        throw new NoRepositoryError();
      }

      if (!run.stationId || !task.stationId.equals(run.stationId)) {
        throw new InvalidTaskTransitionError(
          'has moved on from there, so there is nothing left to answer for',
        );
      }

      const at = RemarkHandle.of(command.handle);
      const line = await this.lines.holding(task.stationId);
      const installation = GitHubInstallation.from(
        await this.workspaces.connectionTo(
          task.workspaceId,
          GitHubInstallation.SOURCE,
        ),
      );

      if (!installation) {
        throw new NoGitHubInstallationError();
      }

      // Post to the host before recording, so the trail never holds an answer the pull request lacks.
      await this.remarks.answer({
        installation,
        repository,
        pullRequest: task.pullRequest,
        remark: task.remarkAt(at),
        body: command.body,
        resolve: command.resolve,
      });

      await this.tasks.save(
        task.repliedTo(at, {
          station:
            line?.stationAt(task.stationId)?.name ?? StationName.unknown(),
          body: TaskNoteBody.of(command.body),
          at: this.clock.now(),
          voice: Voice.station(run.id),
        }),
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
