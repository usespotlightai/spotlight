import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { HookedTasksPort } from '@work/application/ports/hooked-tasks.port';
import type {
  HookVerdict,
  LifecycleHooksPort,
} from '@work/application/ports/lifecycle-hooks.port';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import { RunVersionConflictError } from '@work/domain/exceptions/run-version-conflict.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';

const ATTEMPTS = 3;

const PAST_THE_POLL_MS = 5_000;

const MAX_HOOK_MS = 12_000;

type Heard =
  | HookVerdict
  | { readonly kind: 'unheard'; readonly because: string };

export type RunStart = 'starts' | 'denied' | 'handed-back';

export class RunStartHooks {
  constructor(
    private readonly runs: RunRepository,
    private readonly hookedTasks: HookedTasksPort,
    private readonly hooks: LifecycleHooksPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async mayStart(
    run: Run,
    runner: RunnerId,
    pollUntil: Date,
  ): Promise<RunStart> {
    const verdict = await this.verdictOn(run, pollUntil);

    if (verdict.kind === 'allowed') {
      return 'starts';
    }

    if (verdict.kind === 'denied') {
      await this.revised(run, runner, (current) =>
        current.deniedStart(runner, verdict.reason),
      );
      return 'denied';
    }

    await this.revised(run, runner, (current) =>
      current.handedBack(runner, this.clock.now(), verdict.because),
    );
    return 'handed-back';
  }

  private async verdictOn(run: Run, pollUntil: Date): Promise<Heard> {
    if (!run.hearsHooks || !run.taskId) {
      return { kind: 'allowed' };
    }

    try {
      const hooked = await this.hookedTasks.of(run.taskId.value, run.id.value);

      return hooked
        ? await this.hooks.before(
            hooked,
            { on: 'run.starting' },
            this.hookUntil(pollUntil),
          )
        : { kind: 'allowed' };
    } catch (error) {
      const because = error instanceof Error ? error.message : String(error);

      this.logger.warn(
        { runId: run.id.value, taskId: run.taskId.value, error: because },
        'The hooks could not be asked before a run started, so it was handed back to be claimed again',
      );

      return { kind: 'unheard', because };
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

      if (!found || found.hasEnded || !found.wasWorkedBy(runner)) {
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
