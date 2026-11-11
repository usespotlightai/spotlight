import type { TerraformStateBodiesPort } from '@configuration/application/ports/terraform-state-bodies.port';
import type { TerraformStateRepository } from '@configuration/domain/repositories/terraform-state.repository';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class DeleteWorkspaceStates {
  constructor(
    private readonly states: TerraformStateRepository,
    private readonly bodies: TerraformStateBodiesPort,
    private readonly transaction: TransactionPort,
  ) {}

  async deleteForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    const by = ChangeActor.spotlight(workspaceId);

    for (const state of await this.states.ofWorkspace(workspaceId)) {
      await this.transaction.inTransaction(() =>
        this.states.save(state.deleteWithWorkspace(by)),
      );
    }

    await this.bodies.removeForWorkspace(workspaceId);
  }
}
