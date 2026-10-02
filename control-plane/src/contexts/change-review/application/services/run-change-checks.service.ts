import type {
  ChangeCheckState,
  CheckedChange,
  RunChangeChecksPort,
} from '@change-review/application/ports/run-change-checks.port';
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

const stateOf = (
  stack: ChangeStack,
  check: StackCheck | null,
  now: Date,
): ChangeCheckState => {
  if (stack.state === 'drafting') {
    return 'drafting';
  }
  if (stack.state === 'failed') {
    return 'undrafted';
  }
  if (!stack.request) {
    return 'unchecked';
  }
  if (!check || check.reordering) {
    return 'checking';
  }

  switch (check.stateAt(now)) {
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

  async ofRun(runId: string): Promise<readonly CheckedChange[]> {
    const run = RunId.of(runId);
    const [stacks, checks] = await Promise.all([
      this.stacks.ofRun(run),
      this.checks.ofRun(run),
    ]);
    const now = this.clock.now();

    return stacks.map((stack) => {
      const check =
        checks.find((each) => each.stackId.equals(stack.id)) ?? null;
      const state = stateOf(stack, check, now);

      return {
        repository: stack.repository?.value ?? null,
        state,
        skip:
          state === 'skipped' ? (check?.skippedAt(now)?.code ?? null) : null,
        failedAt: state === 'failed' && check ? failedAt(stack, check) : [],
        spent: {
          costs: stack.spent.costs.map((each) => ({ ...each })),
          unpriced: stack.spent.unpriced,
        },
      };
    });
  }
}
