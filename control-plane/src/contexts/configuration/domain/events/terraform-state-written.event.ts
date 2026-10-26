import type { StateName } from '@configuration/domain/value-objects/state-name.vo';
import type { TerraformStateId } from '@configuration/domain/value-objects/terraform-state-id.vo';
import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class TerraformStateWritten implements ConfigurationChanged {
  readonly kind = 'configuration.terraform-state-written';

  constructor(
    readonly id: TerraformStateId,
    readonly workspaceId: WorkspaceId,
    readonly name: StateName,
    readonly change: ConfigurationChange,
  ) {}
}
