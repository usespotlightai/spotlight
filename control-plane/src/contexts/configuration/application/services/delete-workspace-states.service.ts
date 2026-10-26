import type { TerraformStateBodiesPort } from '@configuration/application/ports/terraform-state-bodies.port';
import type { TerraformStateRepository } from '@configuration/domain/repositories/terraform-state.repository';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class DeleteWorkspaceStates {
  constructor(
    private readonly states: TerraformStateRepository,
    private readonly bodies: TerraformStateBodiesPort,
  ) {}

  async deleteForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    await this.states.deleteForWorkspace(workspaceId);
    await this.bodies.removeForWorkspace(workspaceId);
  }
}
