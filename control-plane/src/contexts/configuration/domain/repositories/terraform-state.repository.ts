import type { TerraformState } from '@configuration/domain/aggregates/terraform-state.aggregate';
import type { StateName } from '@configuration/domain/value-objects/state-name.vo';
import type { StateVersion } from '@configuration/domain/value-objects/state-version.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const TERRAFORM_STATES = Symbol('TERRAFORM_STATES');

export interface TerraformStateRepository {
  named(
    workspaceId: WorkspaceId,
    name: StateName,
  ): Promise<TerraformState | null>;

  save(state: TerraformState): Promise<void>;

  versionsBefore(
    state: TerraformState,
    number: number,
  ): Promise<readonly StateVersion[]>;

  removeVersions(
    state: TerraformState,
    versions: readonly StateVersion[],
  ): Promise<void>;

  deleteForWorkspace(workspaceId: WorkspaceId): Promise<void>;
}
