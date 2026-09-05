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
import { welcomeTask } from '@domain/services/welcome-task';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';

export class ProvisionFactory implements FactoryProvisioningPort {
  constructor(
    private readonly factories: FactoryRepository,
    private readonly lines: AssemblyLineRepository,
    private readonly ids: IdGeneratorPort,
    private readonly tasks: TaskRepository,
    private readonly clock: ClockPort,
    private readonly workspaces: WorkspaceFinding,
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

    const line = AssemblyLine.open({
      workspaceId: event.workspaceId,
      factoryId: opened.id,
      name: AssemblyLineName.of('Default'),
      newId: () => this.ids.generate(),
    });

    await this.lines.add(line);

    const [first] = line.stations;

    // A line with nowhere to put a task is not one this can say anything on.
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
