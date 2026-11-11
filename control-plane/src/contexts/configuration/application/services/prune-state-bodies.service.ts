import type { TerraformStateBodiesPort } from '@configuration/application/ports/terraform-state-bodies.port';
import type { TerraformStateWritten } from '@configuration/domain/events/terraform-state-written.event';

export class PruneStateBodies {
  constructor(private readonly bodies: TerraformStateBodiesPort) {}

  async onWritten(event: TerraformStateWritten): Promise<void> {
    await this.bodies.remove(
      event.dropped.map((versionId) => ({
        workspaceId: event.workspaceId,
        stateId: event.id,
        versionId,
      })),
    );
  }
}
