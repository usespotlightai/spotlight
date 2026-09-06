import type { ClockPort } from '@application/ports/clock.port';
import type { FactoryProvisioningPort } from '@application/ports/factory-provisioning.port';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import { listed } from '@application/services/setup-steps';
import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Factory } from '@domain/aggregates/factory.aggregate';
import type { TeamCreated } from '@domain/events/team-created.event';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { FactoryRepository } from '@domain/repositories/factory.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import type { WorkspaceFinding } from '@domain/repositories/workspace.repository';
import { BUILT_IN_LINES } from '@domain/services/built-in-lines';
import { welcomeTask } from '@domain/services/welcome-task';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import type { HarnessId } from '@domain/value-objects/harness-id.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';

export class ProvisionFactory implements FactoryProvisioningPort {
  constructor(
    private readonly factories: FactoryRepository,
    private readonly lines: AssemblyLineRepository,
    private readonly ids: IdGeneratorPort,
    private readonly tasks: TaskRepository,
    private readonly clock: ClockPort,
    private readonly workspaces: WorkspaceFinding,
    /** What a line's worked stations start running on, so a team with a runner
     *  can begin the moment its lines are open. */
    private readonly harness: HarnessId,
  ) {}

  async onTeamCreated(event: TeamCreated): Promise<void> {
    const workspace = await this.workspaces.find(event.workspaceId);

    if (!workspace) {
      return;
    }

    const opened = Factory.open({
      id: FactoryId.of(this.ids.generate()),
      workspaceId: event.workspaceId,
      teamId: event.teamId,
    });

    await this.factories.add(opened);

    const lines = BUILT_IN_LINES.map((line) => {
      const built = AssemblyLine.open({
        workspaceId: event.workspaceId,
        factoryId: opened.id,
        line,
        newId: () => this.ids.generate(),
      });

      // Every station where work is done starts on the default harness; a
      // backlog and an end run nothing, so they are left worked by none.
      return built.worked.reduce(
        (each, station) => each.runStationOn(station.id, this.harness),
        built,
      );
    });

    for (const line of lines) {
      await this.lines.add(line);
    }

    // The welcome task lands where work first enters the line a team delivers
    // on — the first line it was opened with.
    const [delivery] = lines;
    const first = delivery?.stations[0];

    if (!first) {
      return;
    }

    await this.tasks.add(
      welcomeTask({
        workspaceId: event.workspaceId,
        teamId: event.teamId,
        saying: TaskNoteBody.of(
          listed({ slug: workspace.slug.value, teamId: event.teamId.value }),
        ),
        stationId: first.id,
        station: first.name,
        owner: event.owner,
        now: this.clock.now(),
        newId: () => this.ids.generate(),
      }),
    );
  }
}
