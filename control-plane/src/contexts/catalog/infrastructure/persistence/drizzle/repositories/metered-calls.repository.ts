import type { CallMeterPort } from '@catalog/application/ports/call-meter.port';
import type { MeteredCall } from '@catalog/domain/value-objects/metered-call.vo';
import { catalogCall } from '@catalog/infrastructure/persistence/drizzle/schemas/catalog.schema';
import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import {
  ID_GENERATOR,
  type IdGeneratorPort,
} from '@shared-kernel/application/ports/id-generator.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { eq } from 'drizzle-orm';

@Injectable()
export class DrizzleMeteredCalls implements CallMeterPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
  ) {}

  async record(call: MeteredCall): Promise<void> {
    await this.db.insert(catalogCall).values({
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

  async forget(workspaceId: WorkspaceId): Promise<void> {
    await this.db
      .delete(catalogCall)
      .where(eq(catalogCall.workspaceId, workspaceId.value));
  }
}
