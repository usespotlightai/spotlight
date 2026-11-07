import { WELCOME_LINE_KEY } from '@lines/application/contracts/built-in-lines.contract';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { LinesNotOpenYetError } from '@work/application/errors/lines-not-open-yet.error';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { TeamWelcomesPort } from '@work/application/ports/team-welcomes.port';
import { listed } from '@work/application/services/setup-steps';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { welcomeTask } from '@work/domain/services/welcome-task';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';

export const WELCOME_TEAM = 'work.welcome-team';

export interface NewTeam {
  readonly teamId: TeamId;
  readonly owner: UserId;
}

export class WelcomeTeam {
  constructor(
    private readonly lines: LineMapsPort,
    private readonly tasks: TaskRepository,
    private readonly welcomes: TeamWelcomesPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async welcome(team: NewTeam): Promise<void> {
    if (await this.welcomes.welcomed(team.teamId)) {
      return;
    }

    const delivery = (await this.lines.ofTeam(team.teamId)).find(
      (each) => each.key.value === WELCOME_LINE_KEY,
    );
    const first = delivery?.stations[0];

    if (!delivery || !first) {
      throw new LinesNotOpenYetError(team.teamId.value);
    }

    await this.tasks.add(
      welcomeTask({
        line: delivery,
        noteBody: TaskNoteBody.of(listed()),
        at: first,
        owner: team.owner,
        now: this.clock.now(),
        newId: () => this.ids.generate(),
      }),
    );
    await this.welcomes.record(team.teamId);
  }

  async forget(teamId: TeamId): Promise<void> {
    await this.welcomes.forget(teamId);
  }
}
