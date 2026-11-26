import type { HarnessKeysPort } from '@secrets/application/ports/harness-keys.port';
import type { SecretRecord } from '@secrets/application/ports/secret-resources.port';
import type { SecretUsesPort } from '@secrets/application/ports/secret-uses.port';
import { SecretUses } from '@secrets/domain/value-objects/secret-uses.vo';

export class SecretRunReach {
  constructor(
    private readonly uses: SecretUsesPort,
    private readonly harnessKeys: HarnessKeysPort,
  ) {}

  async unreached(
    records: readonly SecretRecord[],
  ): Promise<ReadonlySet<string>> {
    const harnessKeys = this.harnessKeys.names();
    const reached = await Promise.all(
      records.map(async (record) =>
        SecretUses.of(
          await this.uses.of({
            workspaceId: record.workspaceId.value,
            name: record.name,
          }),
        ).reachesRuns(record.name, harnessKeys),
      ),
    );

    return new Set(
      records.filter((_, at) => !reached[at]).map((each) => each.name),
    );
  }
}
