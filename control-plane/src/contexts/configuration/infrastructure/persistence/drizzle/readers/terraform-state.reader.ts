import type {
  LatestStateVersion,
  TerraformStateReaderPort,
} from '@configuration/application/ports/terraform-state-reader.port';
import type { StateName } from '@configuration/domain/value-objects/state-name.vo';
import { StateVersionId } from '@configuration/domain/value-objects/state-version-id.vo';
import { TerraformStateId } from '@configuration/domain/value-objects/terraform-state-id.vo';
import {
  terraformState,
  terraformStateVersion,
} from '@configuration/infrastructure/persistence/drizzle/schemas/configuration.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleTerraformStateReader implements TerraformStateReaderPort {
  constructor(private readonly context: DrizzleContext) {}

  async latestOf(
    workspaceId: WorkspaceId,
    name: StateName,
  ): Promise<LatestStateVersion | null> {
    const [row] = await this.context.db
      .select({
        stateId: terraformState.id,
        versionId: terraformStateVersion.id,
        number: terraformStateVersion.number,
      })
      .from(terraformState)
      .innerJoin(
        terraformStateVersion,
        eq(terraformStateVersion.id, terraformState.latestVersionId),
      )
      .where(
        and(
          eq(terraformState.workspaceId, workspaceId.value),
          eq(terraformState.name, name.value),
        ),
      )
      .limit(1);

    return row
      ? {
          at: {
            workspaceId,
            stateId: TerraformStateId.of(row.stateId),
            versionId: StateVersionId.of(row.versionId),
          },
          number: row.number,
        }
      : null;
  }
}
