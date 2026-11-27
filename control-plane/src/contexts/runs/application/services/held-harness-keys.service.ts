import type { HarnessLaunchPort } from '@runs/application/ports/harness-launch.port';
import { heldHarnessKeys } from '@runs/domain/services/held-harness-keys';
import type { DefinedSecretsPort } from '@secrets/application/ports/defined-secrets.port';
import type { HarnessKeySource } from '@secrets/application/ports/harness-keys.port';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class HeldHarnessKeys implements HarnessKeySource {
  constructor(
    private readonly launch: HarnessLaunchPort,
    private readonly secrets: DefinedSecretsPort,
  ) {}

  async of(
    workspaceId: WorkspaceId,
    harness: HarnessId,
  ): Promise<readonly SecretName[]> {
    const harnessKeys =
      this.launch.catalogue().find((each) => each.id === harness.value)
        ?.harnessKeys ?? [];

    return this.heldIn(workspaceId, harnessKeys);
  }

  // The keys of every harness in the catalogue, which a host gives its harness with no harness profile that names them.
  names(): readonly string[] {
    return this.launch.catalogue().flatMap((each) => each.harnessKeys);
  }

  async inWorkspace(workspaceId: WorkspaceId): Promise<readonly SecretName[]> {
    return this.heldIn(workspaceId, this.names());
  }

  private async heldIn(
    workspaceId: WorkspaceId,
    harnessKeys: readonly string[],
  ): Promise<readonly SecretName[]> {
    if (harnessKeys.length === 0) {
      return [];
    }

    return heldHarnessKeys(
      harnessKeys,
      await this.secrets.namesIn(workspaceId.value),
    );
  }
}
