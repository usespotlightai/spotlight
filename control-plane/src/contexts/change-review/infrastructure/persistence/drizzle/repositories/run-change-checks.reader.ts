import type {
  CheckedChange,
  RunChangeChecksPort,
} from '@change-review/application/ports/run-change-checks.port';
import type { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import { changeCheckStatusOf } from '@change-review/domain/services/change-check-status';
import { toStackCheck } from '@change-review/infrastructure/persistence/drizzle/repositories/stack-check.repository';
import { changeStack } from '@change-review/infrastructure/persistence/drizzle/schemas/change-stack.schema';
import { stackCheck } from '@change-review/infrastructure/persistence/drizzle/schemas/stack-check.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';
import { asc, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleRunChangeChecksReader implements RunChangeChecksPort {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  ofRun(runId: string): Promise<readonly CheckedChange[]> {
    return this.checkedChanges(runId, false);
  }

  rechecksOfRun(runId: string): Promise<readonly CheckedChange[]> {
    return this.checkedChanges(runId, true);
  }

  private async checkedChanges(
    runId: string,
    rechecks: boolean,
  ): Promise<readonly CheckedChange[]> {
    const stacks = await this.context.db
      .select({
        id: changeStack.id,
        repository: changeStack.repository,
        state: changeStack.state,
        checkCommand: changeStack.checkCommand,
        cohorts: changeStack.cohorts,
        usage: changeStack.usage,
      })
      .from(changeStack)
      .where(eq(changeStack.runId, runId))
      .orderBy(asc(changeStack.startedAt), asc(changeStack.id));
    const checks = (
      await this.context.db
        .select()
        .from(stackCheck)
        .where(eq(stackCheck.runId, runId))
    ).map(toStackCheck);
    const now = this.clock.now();
    const checkOf = (stackId: string, recheck: boolean): StackCheck | null =>
      checks.find(
        (each) => each.stackId.value === stackId && each.recheck === recheck,
      ) ?? null;

    return stacks
      .filter((stack) => !rechecks || checkOf(stack.id, false)?.recheckable)
      .map((stack) => {
        const check = checkOf(stack.id, rechecks);
        const status = changeCheckStatusOf(
          { state: stack.state, requestsCheck: stack.checkCommand !== null },
          check,
          now,
        );
        const titles = new Map(
          stack.cohorts.flatMap((cohort) =>
            cohort.layers.map((layer) => [layer.id, layer.title] as const),
          ),
        );
        const failed = status === 'failed' ? check : null;

        return {
          repository: stack.repository,
          status,
          skip:
            status === 'skipped' ? (check?.skippedAt(now)?.code ?? null) : null,
          failedWhole: failed?.wholeFailed ?? false,
          failedLayers:
            failed?.failedLayers().map((layer) => titles.get(layer) ?? layer) ??
            [],
          usage: {
            costs: stack.usage.costs.map((each) => ({ ...each })),
            unpriced: stack.usage.unpriced,
          },
        };
      });
  }
}
