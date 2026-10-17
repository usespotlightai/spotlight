import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { SetupStatus } from '@work/application/services/setup-status.service';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { InvalidTaskTransitionError } from '@work/domain/exceptions/invalid-task-transition.error';
import { TaskVersionConflictError } from '@work/domain/exceptions/task-version-conflict.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { setupDoneNote } from '@work/domain/services/setup-list';

export class ReconcileSetup {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: LineRepository,
    private readonly setup: SetupStatus,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async forWorkspace(workspaceId: WorkspaceId): Promise<void> {
    await this.looking(workspaceId.value, async () =>
      this.each(await this.tasks.settingUpIn(workspaceId)),
    );
  }

  async forTeam(teamId: TeamId): Promise<void> {
    await this.looking(teamId.value, async () => {
      const task = await this.tasks.settingUpFor(teamId);

      await this.each(task ? [task] : []);
    });
  }

  async wherever(): Promise<void> {
    await this.looking('everywhere', async () =>
      this.each(await this.tasks.settingUp()),
    );
  }

  private async looking(at: string, work: () => Promise<void>): Promise<void> {
    try {
      await work();
    } catch (error) {
      this.logger.warn(
        { err: error, at },
        'could not look for the setup lists to reconcile',
      );
    }
  }

  private async each(tasks: readonly Task[]): Promise<void> {
    for (const each of tasks) {
      await this.reconcile(each);
    }
  }

  private async reconcile(task: Task): Promise<void> {
    const at = { taskId: task.id.value, workspaceId: task.workspaceId.value };

    try {
      const line = await this.lines.findByStation(task.stationId);

      if (!line) {
        this.logger.warn(at, 'found no line that contains a team’s setup list');
        return;
      }

      const { state } = await this.setup.of(task.workspaceId, line.teamId);
      const saying = setupDoneNote(task.notes, state, this.clock.now());

      if (saying) {
        await this.tasks.save(task.closeConversation(saying));
      }
    } catch (error) {
      if (error instanceof TaskVersionConflictError) {
        return;
      }

      if (error instanceof InvalidTaskTransitionError) {
        this.logger.error(
          { err: error, ...at },
          'did not close a team’s setup list, because the task state does not allow it',
        );

        return;
      }

      this.logger.warn(
        { err: error, ...at },
        'could not reconcile a team’s setup list',
      );
    }
  }
}
