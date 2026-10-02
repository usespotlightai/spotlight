import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { BriefedTasksPort } from '@work/application/ports/briefed-tasks.port';
import { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import { run } from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class DrizzleBriefedTasks implements BriefedTasksPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async of(runId: RunId): Promise<BriefedTask | null> {
    const [row] = await this.db
      .select({ briefedTask: run.briefedTask })
      .from(run)
      .where(eq(run.id, runId.value))
      .limit(1);

    return row?.briefedTask ? BriefedTask.rehydrate(row.briefedTask) : null;
  }
}
