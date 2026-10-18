import type { CallMeterPort } from '@catalog/application/ports/call-meter.port';
import type { MeteredCall } from '@catalog/domain/value-objects/metered-call.vo';
import { catalogCall } from '@catalog/infrastructure/persistence/drizzle/schemas/catalog.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  ID_GENERATOR,
  type IdGeneratorPort,
} from '@shared-kernel/application/ports/id-generator.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { eq } from 'drizzle-orm';

@Injectable()
export class DrizzleMeteredCalls implements CallMeterPort {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
  ) {}

  async record(call: MeteredCall): Promise<void> {
    await this.context.db.insert(catalogCall).values({
      id: this.ids.generate(),
      workspaceId: call.workspaceId.value,
      runId: call.runId.value,
      item: call.item.value,
      calledAt: call.at,
      ms: call.ms,
      succeeded: call.succeeded,
      billable: call.billable,
    });
  }

  async deleteForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    await this.context.db
      .delete(catalogCall)
      .where(eq(catalogCall.workspaceId, workspaceId.value));
  }
}
