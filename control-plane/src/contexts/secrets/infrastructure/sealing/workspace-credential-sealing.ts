import type { CredentialSealingPort } from '@secrets/application/ports/credential-sealing.port';
import { opened, sealed } from '@secrets/infrastructure/crypto/envelope';
import type { WorkspaceKeys } from '@secrets/infrastructure/crypto/workspace-keys';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const boundTo = (workspaceId: string, label: string): string =>
  ['spotlight:credential:v1', workspaceId, label].join('\u0000');

export class WorkspaceCredentialSealing implements CredentialSealingPort {
  constructor(private readonly keys: WorkspaceKeys) {}

  async seal(
    workspaceId: string,
    label: string,
    plain: string,
  ): Promise<string> {
    return sealed(
      await this.keys.of(WorkspaceId.of(workspaceId)),
      Buffer.from(plain, 'utf8'),
      boundTo(workspaceId, label),
    );
  }

  async open(
    workspaceId: string,
    label: string,
    written: string,
  ): Promise<string> {
    return opened(
      await this.keys.of(WorkspaceId.of(workspaceId)),
      written,
      boundTo(workspaceId, label),
    ).toString('utf8');
  }
}
