import type { StateVersionId } from '@configuration/domain/value-objects/state-version-id.vo';
import type { TerraformStateId } from '@configuration/domain/value-objects/terraform-state-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const TERRAFORM_STATE_BODIES = Symbol('TERRAFORM_STATE_BODIES');

export interface StateBodyAt {
  readonly workspaceId: WorkspaceId;
  readonly stateId: TerraformStateId;
  readonly versionId: StateVersionId;
}

export interface TerraformStateBodiesPort {
  put(at: StateBodyAt, body: Uint8Array, md5: string): Promise<void>;

  read(at: StateBodyAt): Promise<Uint8Array | null>;

  remove(at: readonly StateBodyAt[]): Promise<void>;

  removeForWorkspace(workspaceId: WorkspaceId): Promise<void>;
}
