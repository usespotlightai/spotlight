import { TerraformState } from '@configuration/domain/aggregates/terraform-state.aggregate';
import type { TerraformStateRepository } from '@configuration/domain/repositories/terraform-state.repository';
import type { StateName } from '@configuration/domain/value-objects/state-name.vo';
import { TerraformStateId } from '@configuration/domain/value-objects/terraform-state-id.vo';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class TerraformStates {
  constructor(
    private readonly states: TerraformStateRepository,
    private readonly ids: IdGeneratorPort,
  ) {}

  async named(
    workspaceId: WorkspaceId,
    name: StateName,
  ): Promise<TerraformState> {
    return (
      (await this.states.named(workspaceId, name)) ??
      TerraformState.open({
        id: TerraformStateId.of(this.ids.generate()),
        workspaceId,
        name,
      })
    );
  }
}
