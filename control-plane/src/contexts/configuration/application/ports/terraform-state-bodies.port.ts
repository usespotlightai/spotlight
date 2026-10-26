import type { TerraformState } from '@configuration/domain/aggregates/terraform-state.aggregate';
import type { StateVersion } from '@configuration/domain/value-objects/state-version.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const TERRAFORM_STATE_BODIES = Symbol('TERRAFORM_STATE_BODIES');

export interface TerraformStateBodiesPort {
  put(
    state: TerraformState,
    version: StateVersion,
    body: Uint8Array,
  ): Promise<void>;

  read(
    state: TerraformState,
    version: StateVersion,
  ): Promise<Uint8Array | null>;

  remove(state: TerraformState, version: StateVersion): Promise<void>;

  removeForWorkspace(workspaceId: WorkspaceId): Promise<void>;
}
