import type { ClockPort } from '@application/ports/clock.port';
import type { FactoryProvisioningPort } from '@application/ports/factory-provisioning.port';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import { listed } from '@application/services/setup-steps';
import { Factory } from '@domain/aggregates/factory.aggregate';
import { Line } from '@domain/aggregates/line.aggregate';
import type { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { TeamCreated } from '@domain/events/team-created.event';
import type { FactoryRepository } from '@domain/repositories/factory.repository';
import type { LineRepository } from '@domain/repositories/line.repository';
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
    private readonly lines: LineRepository,
    private readonly ids: IdGeneratorPort,
    private readonly tasks: TaskRepository,
    private readonly clock: ClockPort,
    private readonly workspaces: WorkspaceFinding,
    private readonly harness: HarnessId,
    private readonly transaction: TransactionPort,
  ) {}

  async onTeamCreated(event: TeamCreated): Promise<void> {
    const workspace = await this.workspaces.find(event.workspaceId);

    if (!workspace) {
      return;
    }

    await this.transaction.run(() => this.provision(event, workspace));
  }

  private async provision(
    event: TeamCreated,
    workspace: Workspace,
  ): Promise<void> {
    const opened = Factory.open({
      id: FactoryId.of(this.ids.generate()),
      workspaceId: event.workspaceId,
      teamId: event.teamId,
    });

    await this.factories.add(opened);

    const lines = BUILT_IN_LINES.map((line) => {
      const built = Line.open({
        workspaceId: event.workspaceId,
        factoryId: opened.id,
        line,
        newId: () => this.ids.generate(),
      });

      return built.worked.reduce(
        (each, station) =>
          each.changeStationHarness(station.id, {
            harness: this.harness,
            model: null,
          }),
        built,
      );
    });

    for (const line of lines) {
      await this.lines.add(line);
    }

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
