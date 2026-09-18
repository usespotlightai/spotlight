import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { SetupSettlingPort } from '@work/application/ports/setup-settling.port';
import {
  asSetupState,
  type TeamSetup,
} from '@work/application/services/team-setup.service';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { InvalidTaskTransitionError } from '@work/domain/exceptions/invalid-task-transition.error';
import { TaskMovedOnError } from '@work/domain/exceptions/task-moved-on.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { settling } from '@work/domain/services/setup-list';

export class SettleSetup implements SetupSettlingPort {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: LineRepository,
    private readonly setup: TeamSetup,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async forTeam(teamId: TeamId): Promise<void> {
    await this.looking(teamId.value, async () => {
      const standing = await this.tasks.settingUpFor(teamId);

      if (standing) {
        await this.settle(standing, teamId);
      }
    });
  }

  async forWorkspace(workspaceId: WorkspaceId): Promise<void> {
    await this.looking(workspaceId.value, async () =>
      this.each(await this.tasks.settingUpIn(workspaceId)),
    );
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
      const line = await this.lines.holding(each.stationId);

      if (line) {
        await this.settle(each, line.teamId);
      }
    }
  }

  private async settle(task: Task, teamId: TeamId): Promise<void> {
    try {
      const facts = await this.setup.factsFor(task.workspaceId, teamId);

      const saying = settling(
        task.notes,
        asSetupState(facts),
        this.clock.now(),
      );

      if (saying) {
        await this.tasks.save(task.settled(saying));
      }
    } catch (error) {
      if (error instanceof TaskMovedOnError) {
        return;
      }

      if (error instanceof InvalidTaskTransitionError) {
        this.logger.error(
          { err: error, teamId: teamId.value },
          'refused to settle a team’s setup list',
        );

        return;
      }

      this.logger.warn(
        { err: error, teamId: teamId.value },
        'could not settle a team’s setup list',
      );
    }
  }
}
