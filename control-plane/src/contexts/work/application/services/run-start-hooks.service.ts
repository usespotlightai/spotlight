import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type {
  HookDecision,
  LifecycleHooksPort,
} from '@work/application/ports/lifecycle-hooks.port';
import type { TaskViewsPort } from '@work/application/ports/task-views.port';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import { RunVersionConflictError } from '@work/domain/exceptions/run-version-conflict.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';

const ATTEMPTS = 3;

const PAST_THE_POLL_MS = 5_000;

const MAX_HOOK_MS = 12_000;

type HookOutcome =
  | HookDecision
  | { readonly kind: 'no-reply'; readonly because: string };

export type RunStart = 'starts' | 'denied' | 'requeued';

export class RunStartHooks {
  constructor(
    private readonly runs: RunRepository,
    private readonly taskViews: TaskViewsPort,
    private readonly hooks: LifecycleHooksPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async mayStart(
    run: Run,
    runner: RunnerId,
    pollUntil: Date,
  ): Promise<RunStart> {
    const decision = await this.decisionOn(run, pollUntil);

    if (decision.kind === 'allowed') {
      return 'starts';
    }

    if (decision.kind === 'denied') {
      await this.revised(run, runner, (current) =>
        current.deniedStart(runner, decision.reason),
      );
      return 'denied';
    }

    await this.revised(run, runner, (current) =>
      current.requeue(runner, this.clock.now(), decision.because),
    );
    return 'requeued';
  }

  private async decisionOn(run: Run, pollUntil: Date): Promise<HookOutcome> {
    if (!run.firesHooks || !run.taskId) {
      return { kind: 'allowed' };
    }

    try {
      const taskView = await this.taskViews.of(run.taskId.value, run.id.value);

      return taskView
        ? await this.hooks.before(
            taskView,
            { on: 'run.starting' },
            this.hookUntil(pollUntil),
          )
        : { kind: 'allowed' };
    } catch (error) {
      const because = error instanceof Error ? error.message : String(error);

      this.logger.warn(
        { runId: run.id.value, taskId: run.taskId.value, error: because },
        'The hooks could not be called before a run started, so it was requeued to be claimed again',
      );

      return { kind: 'no-reply', because };
    }
  }

  private hookUntil(pollUntil: Date): Date {
    return new Date(
      Math.min(
        pollUntil.getTime() + PAST_THE_POLL_MS,
        this.clock.now().getTime() + MAX_HOOK_MS,
      ),
    );
  }

  private async revised(
    run: Run,
    runner: RunnerId,
    change: (current: Run) => Run,
  ): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      const found = await this.runs.findById(run.id);

      if (!found || found.hasEnded || !found.wasClaimedBy(runner)) {
        return;
      }

      try {
        await this.runs.save(change(found));
        return;
      } catch (error) {
        if (
          !(error instanceof RunVersionConflictError) ||
          attempt >= ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }
}
