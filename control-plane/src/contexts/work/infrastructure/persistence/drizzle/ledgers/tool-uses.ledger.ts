import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import type { ToolUsesPort } from '@work/application/ports/tool-uses.port';
import type { RecordedToolUse } from '@work/domain/entities/recorded-tool-use.entity';
import { toolUse } from '@work/infrastructure/persistence/drizzle/schemas/tool-use.schema';
import { inArray, lt } from 'drizzle-orm';

@Injectable()
export class DrizzleToolUses implements ToolUsesPort {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async record(use: RecordedToolUse): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.context.db.insert(toolUse).values({
        useId: use.useId,
        runId: use.runId.value,
        attempt: use.attempt,
        tool: use.tool.value,
        inputs: use.inputs.values,
        output: use.output.json,
        failed: use.failed,
        actingAs: use.actingAs
          ? {
              personId: use.actingAs.personId?.value ?? null,
              linkedAccount: use.actingAs.linkedAccount,
            }
          : null,
        at: use.at,
      });
      await this.events.dispatch(use.pullEvents());
    });
  }

  async purgeBefore(before: Date, max: number): Promise<number> {
    const doomed = this.context.db
      .select({ useId: toolUse.useId })
      .from(toolUse)
      .where(lt(toolUse.at, before))
      .limit(max);
    const purged = await this.context.db
      .delete(toolUse)
      .where(inArray(toolUse.useId, doomed))
      .returning({ useId: toolUse.useId });

    return purged.length;
  }
}
