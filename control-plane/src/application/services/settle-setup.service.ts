import type { ClockPort } from '@application/ports/clock.port';
import type { LoggerPort } from '@application/ports/logger.port';
import {
  asSetupState,
  type TeamSetup,
} from '@application/services/team-setup.service';
import { InvalidTaskTransitionError } from '@domain/exceptions/invalid-task-transition.error';
import { TaskMovedOnError } from '@domain/exceptions/task-moved-on.error';
import type {
  SetupLists,
  StandingSetup,
} from '@domain/repositories/task.repository';
import { settling } from '@domain/services/setup-list';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export class SettleSetup {
  constructor(
    private readonly lists: SetupLists,
    private readonly setup: TeamSetup,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async forTeam(teamId: TeamId): Promise<void> {
    await this.looking(teamId.value, async () => {
      const standing = await this.lists.settingUpFor(teamId);

      if (standing) {
        await this.settle(standing);
      }
    });
  }

  async forWorkspace(workspaceId: WorkspaceId): Promise<void> {
    await this.looking(workspaceId.value, async () =>
      this.each(await this.lists.settingUpIn(workspaceId)),
    );
  }

  async wherever(): Promise<void> {
    await this.looking('everywhere', async () =>
      this.each(await this.lists.settingUp()),
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

  private async each(standing: readonly StandingSetup[]): Promise<void> {
    for (const each of standing) {
      await this.settle(each);
    }
  }

  private async settle({ teamId, task }: StandingSetup): Promise<void> {
    try {
      const facts = await this.setup.factsFor(task.workspaceId, teamId);

      const saying = settling(
        task.notes,
        asSetupState(facts),
        this.clock.now(),
      );

      if (saying) {
        await this.lists.save(task.settled(saying));
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
