import type { StateBodyAt } from '@configuration/application/ports/terraform-state-bodies.port';
import type { StateName } from '@configuration/domain/value-objects/state-name.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const TERRAFORM_STATE_READER = Symbol('TERRAFORM_STATE_READER');

export interface LatestStateVersion {
  readonly at: StateBodyAt;
  readonly number: number;
}

export interface TerraformStateReaderPort {
  latestOf(
    workspaceId: WorkspaceId,
    name: StateName,
  ): Promise<LatestStateVersion | null>;
}
