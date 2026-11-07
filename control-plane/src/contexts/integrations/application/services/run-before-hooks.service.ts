import type {
  HookEventInstance,
  HookRuntimePort,
  ListeningHook,
  StepOutcome,
  StepResult,
} from '@integrations/application/ports/hook-runtime.port';
import type { TaskView } from '@integrations/application/ports/tasks-for-hooks.port';
import { hookMatches } from '@integrations/application/services/hook-matching';
import type { HookSteps } from '@integrations/application/services/hook-steps.service';
import type { Hook } from '@integrations/domain/value-objects/hook.vo';
import { HookDecision } from '@integrations/domain/value-objects/hook-decision.vo';
import type { HookEventName } from '@integrations/domain/value-objects/hook-event.vo';
import { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const reasonOf = (outcome: StepOutcome): string =>
  outcome.status === 'failed' ? outcome.reason : 'had no answer in time';

const because = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const errored = (name: string, error: unknown): StepResult => {
  const failure = HookFailure.errored(because(error));

  return {
    outcome: {
      name,
      status: 'failed',
      code: failure.code,
      reason: failure.reason,
      output: null,
    },
    denyReason: null,
    trace: null,
  };
};

export class RunBeforeHooks {
  constructor(
    private readonly runtime: HookRuntimePort,
    private readonly steps: HookSteps,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async decide(
    task: TaskView,
    on: HookEventName,
    event: Readonly<Record<string, unknown>>,
    until: Date | null = null,
  ): Promise<HookDecision> {
    const instance: HookEventInstance = {
      on,
      occurrence: this.ids.generate(),
      at: this.clock.now(),
      task,
      event,
      firing: null,
    };
    const budget = HookDecision.budgetFrom(instance.at, until);

    for (const hook of await this.runtime.listening(task.teamId, on)) {
      if (hook.broken || !hook.written) {
        this.logger.warn(
          { hook: hook.key.value, reason: hook.broken },
          'A hook no longer reads as it was written',
        );

        const decision = HookDecision.onBrokenHook(
          hook.key.value,
          hook.broken ?? '',
          hook.blocks,
        );

        if (decision.denies) {
          return decision;
        }

        continue;
      }

      if (!hookMatches(this.runtime, hook, instance)) {
        continue;
      }

      const decision = await this.ran(hook, hook.written, instance, budget);

      if (decision.denies) {
        return decision;
      }
    }

    return HookDecision.allowed();
  }

  private async ran(
    hook: ListeningHook,
    written: Hook,
    instance: HookEventInstance,
    budget: Date,
  ): Promise<HookDecision> {
    const deadline = written.deadlineFrom(this.clock.now(), budget);
    const earlier: StepOutcome[] = [];

    for (const { name: step } of written.steps) {
      const stepResult = await this.steps
        .take({
          hook,
          step,
          instance,
          earlier,
          resuming: null,
          deadline,
          waitMode: 'wait',
        })
        .catch((error: unknown) => errored(step, error));

      await this.steps.traced(instance, stepResult);
      earlier.push(stepResult.outcome);

      const failedBecause =
        stepResult.outcome.status === 'done'
          ? null
          : reasonOf(stepResult.outcome);

      if (failedBecause !== null && stepResult.denyReason === null) {
        this.logger.warn(
          { hook: hook.key.value, step, reason: failedBecause },
          'A hook before an event failed',
        );
      }

      const decision = written.decisionOn(step, {
        denyReason: stepResult.denyReason,
        failedBecause,
      });

      if (decision) {
        return decision;
      }
    }

    return HookDecision.allowed();
  }
}
