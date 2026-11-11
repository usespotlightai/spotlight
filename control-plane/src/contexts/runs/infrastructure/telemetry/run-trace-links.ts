import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { linkActiveSpanTo } from '@platform/telemetry/trace-context';
import type { RunTraceLinksPort } from '@runs/application/ports/run-trace-links.port';
import { run } from '@runs/infrastructure/persistence/drizzle/schemas/run.schema';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { eq } from 'drizzle-orm';

@Injectable()
export class DrizzleRunTraceLinks implements RunTraceLinksPort {
  constructor(private readonly context: DrizzleContext) {}

  async linkActiveSpanTo(runId: RunId): Promise<void> {
    const [found] = await this.context.db
      .select({ traceparent: run.traceparent })
      .from(run)
      .where(eq(run.id, runId.value))
      .limit(1);

    linkActiveSpanTo(found?.traceparent ?? null);
  }
}
