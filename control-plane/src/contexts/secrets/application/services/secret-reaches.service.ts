import type { EgressRunnersPort } from '@secrets/application/ports/egress-runners.port';
import type { HarnessKeysPort } from '@secrets/application/ports/harness-keys.port';
import type { SecretRecord } from '@secrets/application/ports/secret-resources.port';
import type { SecretUsesPort } from '@secrets/application/ports/secret-uses.port';
import { SecretBindings } from '@secrets/domain/value-objects/secret-bindings.vo';
import { SecretReach } from '@secrets/domain/value-objects/secret-reach.vo';
import { SecretUses } from '@secrets/domain/value-objects/secret-uses.vo';

export interface ReachedSecret {
  readonly record: SecretRecord;
  readonly reach: SecretReach;
}

interface WorkspaceReach {
  readonly harnessKeys: readonly string[];
  readonly egressRunners: boolean;
}

// Gathers what the domain needs to say how a secret reaches runs: its uses, the harness keys, and whether a runner of its workspace has egress.
export class SecretReaches {
  constructor(
    private readonly uses: SecretUsesPort,
    private readonly harnessKeys: HarnessKeysPort,
    private readonly egressRunners: EgressRunnersPort,
  ) {}

  async of(record: SecretRecord): Promise<SecretReach> {
    return this.reachOf(record, await this.workspace(record));
  }

  // Asks about each workspace once, however many of its secrets there are.
  async ofEach(
    records: readonly SecretRecord[],
  ): Promise<readonly ReachedSecret[]> {
    const workspaces = new Map<string, Promise<WorkspaceReach>>();

    return Promise.all(
      records.map(async (record) => {
        const id = record.workspaceId.value;
        const workspace = workspaces.get(id) ?? this.workspace(record);
        workspaces.set(id, workspace);

        return { record, reach: await this.reachOf(record, await workspace) };
      }),
    );
  }

  private async workspace(record: SecretRecord): Promise<WorkspaceReach> {
    return {
      harnessKeys: this.harnessKeys.names(),
      egressRunners: await this.egressRunners.anyIn(record.workspaceId.value),
    };
  }

  private async reachOf(
    record: SecretRecord,
    workspace: WorkspaceReach,
  ): Promise<SecretReach> {
    const uses = await this.uses.of({
      workspaceId: record.workspaceId.value,
      name: record.name,
    });

    return SecretReach.of(
      {
        name: record.name,
        uses: SecretUses.of(uses),
        bindings: SecretBindings.of(record.bindings),
      },
      workspace,
    );
  }
}
