import type {
  ChangeCheckStatus,
  CheckedChange,
  RunChangeChecksPort,
} from '@change-review/application/ports/run-change-checks.port';
import { recheckable } from '@change-review/application/services/recheck-replay-changes.service';
import type { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import type { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const WHOLE_CHANGE = 'the whole change';

const layerTitles = (stack: ChangeStack): ReadonlyMap<string, string> =>
  new Map(
    stack.cohorts.flatMap((cohort) =>
      cohort.layers.map((layer) => [layer.id, layer.title] as const),
    ),
  );

const failedAt = (stack: ChangeStack, check: StackCheck): string[] => {
  const titles = layerTitles(stack);

  return [
    ...(check.wholeFailed ? [WHOLE_CHANGE] : []),
    ...check.failedLayers().map((layer) => titles.get(layer) ?? layer),
  ];
};

const statusOf = (
  stack: ChangeStack,
  check: StackCheck | null,
  now: Date,
): ChangeCheckStatus => {
  if (stack.state === 'generating') {
    return 'generating';
  }
  if (stack.state === 'failed') {
    return 'not-generated';
  }
  if (!stack.request) {
    return 'unchecked';
  }
  if (!check || check.redrafting) {
    return 'checking';
  }

  switch (check.statusAt(now)) {
    case 'waiting':
      return 'checking';
    case 'skipped':
      return 'skipped';
    default:
      return check.wholeFailed ? 'failed' : 'passed';
  }
};

export class RunChangeChecks implements RunChangeChecksPort {
  constructor(
    private readonly stacks: ChangeStackRepository,
    private readonly checks: StackCheckRepository,
    private readonly clock: ClockPort,
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
    const run = RunId.of(runId);
    const stacks = await this.stacks.ofRun(run);
    const checks = await this.checks.ofRun(run);
    const now = this.clock.now();
    const rechecked = (stack: ChangeStack): boolean =>
      checks.some((each) => recheckable(each) && each.stackId.equals(stack.id));

    return stacks.filter(rechecks ? rechecked : () => true).map((stack) => {
      const check =
        checks.find(
          (each) => each.recheck === rechecks && each.stackId.equals(stack.id),
        ) ?? null;
      const status = statusOf(stack, check, now);

      return {
        repository: stack.repository?.value ?? null,
        status,
        skip:
          status === 'skipped' ? (check?.skippedAt(now)?.code ?? null) : null,
        failedAt: status === 'failed' && check ? failedAt(stack, check) : [],
        usage: {
          costs: stack.usage.costs.map((each) => ({ ...each })),
          unpriced: stack.usage.unpriced,
        },
      };
    });
  }
}
