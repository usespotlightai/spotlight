import type { PullRequestPort } from '@github/application/ports/pull-request.port';
import type { HookFiringHistoryPort } from '@integrations/application/ports/hook-firing-history.port';
import type {
  HookEventInstance,
  HookRuntimePort,
  ListeningHook,
  StepOutcome,
} from '@integrations/application/ports/hook-runtime.port';
import type {
  TasksForHooksPort,
  TaskView,
} from '@integrations/application/ports/tasks-for-hooks.port';
import { hookMatches } from '@integrations/application/services/hook-matching';
import type { HookSteps } from '@integrations/application/services/hook-steps.service';
import type { HookFiring } from '@integrations/domain/aggregates/hook-firing.aggregate';
import { HookFiringVersionConflictError } from '@integrations/domain/exceptions/hook-firing-version-conflict.error';
import type { HookFiringRepository } from '@integrations/domain/repositories/hook-firing.repository';
import type { Hook } from '@integrations/domain/value-objects/hook.vo';
import { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';
import type { CausationPort } from '@shared-kernel/application/ports/causation.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';
import type { TaskNotesFromHooksPort } from '@work/application/ports/task-notes-from-hooks.port';

interface LeasedFiring {
  firing: HookFiring;
}

const because = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const unlessVersionConflict = async (
  work: () => Promise<void>,
): Promise<void> => {
  try {
    await work();
  } catch (error) {
    if (!(error instanceof HookFiringVersionConflictError)) {
      throw error;
    }
  }
};

export class WorkHookFirings {
  constructor(
    private readonly runtime: HookRuntimePort,
    private readonly steps: HookSteps,
    private readonly firings: HookFiringRepository,
    private readonly history: HookFiringHistoryPort,
    private readonly tasks: TasksForHooksPort,
    private readonly notes: TaskNotesFromHooksPort,
    private readonly pullRequests: PullRequestPort,
    private readonly clock: ClockPort,
    private readonly causation: CausationPort,
    private readonly logger: LoggerPort,
    private readonly telemetry: TelemetryPort,
  ) {}

  async workOne(): Promise<boolean> {
    const claimed = await this.firings.claimNext(this.clock.now());

    if (!claimed) {
      return false;
    }

    const leased: LeasedFiring = { firing: claimed };

    await unlessVersionConflict(async () => {
      const failure = await this.causation
        .runWith(claimed.cause.append(claimed.link), () =>
          this.delivered(leased),
        )
        .catch((error: unknown) => {
          if (error instanceof HookFiringVersionConflictError) {
            throw error;
          }

          this.logger.error(
            { err: error, firingId: leased.firing.id.value },
            'A hook firing failed in Spotlight',
          );

          return HookFailure.errored(because(error));
        });

      if (failure) {
        await this.recordFailure(leased.firing, failure);
      }
    });

    return true;
  }

  async processDue(limit = 50): Promise<number> {
    let worked = 0;

    while (worked < limit && (await this.workOne())) {
      worked += 1;
    }

    return worked;
  }

  private async recordFailure(
    firing: HookFiring,
    failure: HookFailure,
  ): Promise<void> {
    const now = this.clock.now();
    const movedOn = firing.willRetry(failure, now)
      ? false
      : await this.notes.movedOn(firing.taskId.value, firing.stationKey.value);

    await this.firings.save(firing.failedWith(failure, now, movedOn));
  }

  private async stopped(
    leased: LeasedFiring,
    hook: string,
    loop: HookFailure,
  ): Promise<void> {
    if (!leased.firing.stoppedForLooping) {
      leased.firing = await this.saved(leased.firing.stopForLoop(loop));
      this.counted('loop_stopped');
    }

    const { firing } = leased;

    try {
      const notice = await this.notes.failed({
        taskId: firing.taskId.value,
        stationKey: firing.stationKey.value,
        hook,
        code: loop.code,
        reason: loop.reason,
        receivedAs: `loop:${firing.id.value}`,
      });

      this.logger.warn(
        { hook, task: firing.taskId.value, loop: loop.reason, notice },
        'Stopped a hook that would loop',
      );

      await this.firings.save(
        firing.markLoopNotified(this.clock.now(), notice !== 'reported'),
      );
    } catch (error) {
      if (error instanceof HookFiringVersionConflictError) {
        throw error;
      }

      this.logger.warn(
        { err: error, hook, task: firing.taskId.value },
        'Could not yet send the notice of a hook stopped for looping',
      );
      await this.firings.save(
        firing.failedWith(
          HookFailure.unavailable(because(error)),
          this.clock.now(),
          false,
        ),
      );
    }
  }

  private async saved(firing: HookFiring): Promise<HookFiring> {
    await this.firings.save(firing);

    const reloaded = await this.firings.withId(firing.id);

    if (!reloaded) {
      throw new HookFiringVersionConflictError(firing.id.value);
    }

    return reloaded;
  }

  private counted(outcome: 'skipped' | 'loop_stopped'): void {
    this.telemetry.count('spotlight.hook_firings', {
      'spotlight.hook_firing.outcome': outcome,
    });
  }

  private skipped(
    firing: HookFiring,
    reason: 'hook-deleted' | 'no-longer-matches',
  ): void {
    this.counted('skipped');
    this.logger.info(
      {
        workspaceId: firing.workspaceId.value,
        taskId: firing.taskId.value,
        runId: firing.runId?.value,
        firingId: firing.id.value,
        hookId: firing.hookId.value,
        reason,
      },
      'Skipped a hook firing',
    );
  }

  private async delivered(leased: LeasedFiring): Promise<HookFailure | null> {
    const { firing } = leased;
    const hook = await this.runtime.hook(firing.hookId);

    if (!hook) {
      await this.firings.save(firing.worked(this.clock.now()));
      this.skipped(firing, 'hook-deleted');
      return null;
    }

    if (hook.broken || !hook.written) {
      await this.firings.save(
        firing.hookBroken(hook.key.value, hook.broken ?? '', this.clock.now()),
      );
      return null;
    }

    const task = await this.tasks.of(firing.taskId, firing.runId);

    if (!task) {
      await this.firings.save(firing.taskGone(this.clock.now()));
      return null;
    }

    const instance = await this.eventInstanceOf(firing, task);

    if (!firing.matched) {
      if (!hookMatches(this.runtime, hook, instance)) {
        await this.firings.save(firing.worked(this.clock.now()));
        this.skipped(firing, 'no-longer-matches');
        return null;
      }

      leased.firing = await this.saved(firing.recordMatch(instance.event));
    }

    const loop = leased.firing.loopStop(
      hook.key.value,
      await this.history.recentRepeats(leased.firing.repeatsOf),
    );

    if (loop) {
      await this.stopped(leased, hook.key.value, loop);
      return null;
    }

    return this.stepped(leased, hook, hook.written, instance);
  }

  private async stepped(
    leased: LeasedFiring,
    hook: ListeningHook,
    written: Hook,
    instance: HookEventInstance,
  ): Promise<HookFailure | null> {
    const done = new Map(leased.firing.steps.map((step) => [step.name, step]));
    const earlier: StepOutcome[] = [];

    for (const { name: step } of written.steps) {
      const before = done.get(step);

      if (before?.status === 'done') {
        earlier.push(before);
        continue;
      }

      const stepResult = await this.steps.take({
        hook,
        step,
        instance,
        earlier,
        resuming: before?.status === 'waiting' ? before : null,
        deadline: written.deadlineFrom(this.clock.now(), null),
        waitMode: 'suspend',
      });

      if (stepResult.outcome.status === 'waiting') {
        const waiting = await this.saved(
          leased.firing.recordStep([...earlier, stepResult.outcome]),
        );

        await this.firings.save(waiting.waitedOn(this.clock.now()));
        return null;
      }

      await this.steps.traced(instance, stepResult);

      if (stepResult.outcome.status === 'failed') {
        leased.firing = await this.saved(
          leased.firing.recordStep([...earlier, stepResult.outcome]),
        );

        return HookFailure.of(
          stepResult.outcome.code,
          stepResult.outcome.reason,
        ).atStep(hook.key.value, step);
      }

      earlier.push(stepResult.outcome);
      leased.firing = await this.saved(leased.firing.recordStep(earlier));
    }

    await this.firings.save(leased.firing.worked(this.clock.now()));
    return null;
  }

  private async eventInstanceOf(
    firing: HookFiring,
    task: TaskView,
  ): Promise<HookEventInstance> {
    const changes = firing.changesToRead;

    return {
      on: firing.on,
      occurrence: firing.occurrence,
      at: firing.firedAt,
      task,
      event: changes
        ? firing.eventWithChanges(
            await this.pullRequests.changedIn(
              firing.workspaceId,
              changes.repository,
              changes.pullRequest,
            ),
          )
        : firing.event,
      firing: firing.id,
    };
  }
}
