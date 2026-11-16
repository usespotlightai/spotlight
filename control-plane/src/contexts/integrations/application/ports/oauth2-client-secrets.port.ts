import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface OAuth2ClientSecretsPort {
  sentTo(
    workspaceId: WorkspaceId,
    secret: SecretName,
    url: string,
  ): Promise<string>;
}
