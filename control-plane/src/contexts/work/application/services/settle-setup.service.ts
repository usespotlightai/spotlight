import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { SetupStanding } from '@work/application/services/setup-standing.service';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { InvalidTaskTransitionError } from '@work/domain/exceptions/invalid-task-transition.error';
import { TaskVersionConflictError } from '@work/domain/exceptions/task-version-conflict.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { settling } from '@work/domain/services/setup-list';

export class SettleSetup {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: LineRepository,
    private readonly setup: SetupStanding,
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
      const standing = await this.tasks.settingUpFor(teamId);

      await this.each(standing ? [standing] : []);
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
        'could not look for the setup lists to settle',
      );
    }
  }

  private async each(standing: readonly Task[]): Promise<void> {
    for (const each of standing) {
      await this.settle(each);
    }
  }

  private async settle(task: Task): Promise<void> {
    const at = { taskId: task.id.value, workspaceId: task.workspaceId.value };

    try {
      const line = await this.lines.findByStation(task.stationId);

      if (!line) {
        this.logger.warn(at, 'found no line that contains a team’s setup list');
        return;
      }

      const { state } = await this.setup.of(task.workspaceId, line.teamId);
      const saying = settling(task.notes, state, this.clock.now());

      if (saying) {
        await this.tasks.save(task.settled(saying));
      }
    } catch (error) {
      if (error instanceof TaskVersionConflictError) {
        return;
      }

      if (error instanceof InvalidTaskTransitionError) {
        this.logger.error(
          { err: error, ...at },
          'refused to settle a team’s setup list',
        );

        return;
      }

      this.logger.warn(
        { err: error, ...at },
        'could not settle a team’s setup list',
      );
    }
  }
}
