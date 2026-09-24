import type { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class SecretRedefined implements ConfigurationChanged {
  readonly kind = 'secret.redefined';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly secretId: SecretId,
    readonly secretName: SecretName,
    readonly change: ConfigurationChange,
  ) {}
}
