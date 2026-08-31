import type { FactoryProvisioningPort } from '@application/ports/factory-provisioning.port';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Factory } from '@domain/aggregates/factory.aggregate';
import type { TeamCreated } from '@domain/events/team-created.event';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { FactoryRepository } from '@domain/repositories/factory.repository';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';

export class ProvisionFactory implements FactoryProvisioningPort {
  constructor(
    private readonly factories: FactoryRepository,
    private readonly lines: AssemblyLineRepository,
    private readonly ids: IdGeneratorPort,
  ) {}

  async onTeamCreated(event: TeamCreated): Promise<void> {
    const opened = Factory.open({
      id: FactoryId.of(this.ids.generate()),
      workspaceId: event.workspaceId,
      teamId: event.teamId,
    });

    await this.factories.add(opened);

    await this.lines.add(
      AssemblyLine.open({
        workspaceId: event.workspaceId,
        factoryId: opened.id,
        name: AssemblyLineName.of('Default'),
        newId: () => this.ids.generate(),
      }),
    );
  }
}
