import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { listed } from '@work/application/services/setup-steps';
import { Line } from '@work/domain/aggregates/line.aggregate';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import {
  BUILT_IN_LINES,
  type LineOpening,
} from '@work/domain/services/built-in-lines';
import { welcomeTask } from '@work/domain/services/welcome-task';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';

export const SEED_TEAM = 'work.seed-team';

class LinesNotOpenYet extends Error {}

export interface NewTeam {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly owner: UserId;
}

const DELIVERY = BUILT_IN_LINES[0] as LineOpening;

export class SeedTeam {
  constructor(
    private readonly lines: LineRepository,
    private readonly tasks: TaskRepository,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly harness: HarnessId,
  ) {}

  async seed(team: NewTeam): Promise<void> {
    await this.createLines(team);
    await this.welcome(team);
  }

  private async createLines(team: NewTeam): Promise<void> {
    const existing = await this.lines.ofTeam(team.teamId);

    for (const opening of BUILT_IN_LINES) {
      if (existing.some((each) => each.key.equals(opening.key))) {
        continue;
      }

      await this.lines.add(this.lineFor(team, opening));
    }
  }

  private async welcome(team: NewTeam): Promise<void> {
    if (await this.tasks.settingUpFor(team.teamId)) {
      return;
    }

    const delivery = (await this.lines.ofTeam(team.teamId)).find((each) =>
      each.key.equals(DELIVERY.key),
    );
    const first = delivery?.stations[0];

    if (!delivery || !first) {
      throw new LinesNotOpenYet(
        'the team’s lines are not open yet, so there is nowhere to welcome it',
      );
    }

    await this.tasks.add(
      welcomeTask({
        line: delivery,
        teamId: team.teamId,
        noteBody: TaskNoteBody.of(listed()),
        at: first.id,
        station: first.name,
        owner: team.owner,
        now: this.clock.now(),
        newId: () => this.ids.generate(),
      }),
    );
  }

  private lineFor(team: NewTeam, opening: LineOpening): Line {
    const built = Line.create({
      workspaceId: team.workspaceId,
      teamId: team.teamId,
      line: opening,
      newId: () => this.ids.generate(),
      by: ChangeActor.spotlight(team.workspaceId),
    });

    return built.agentStations.reduce(
      (each, station) =>
        each.changeStationHarness(station.id, {
          harness: this.harness,
          model: null,
        }),
      built,
    );
  }
}
