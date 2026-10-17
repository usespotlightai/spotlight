import type { PullRequestPort } from '@github/application/ports/pull-request.port';
import type { HookCallsPort } from '@integrations/application/ports/hook-calls.port';
import type { HookFiringHistoryPort } from '@integrations/application/ports/hook-firing-history.port';
import type {
  HookEventInstance,
  HookRuntimePort,
  ListeningHook,
  StepOutcome,
  StepRequest,
  StepResult,
} from '@integrations/application/ports/hook-runtime.port';
import type {
  TasksForHooksPort,
  TaskView,
} from '@integrations/application/ports/tasks-for-hooks.port';
import { HookFiring } from '@integrations/domain/aggregates/hook-firing.aggregate';
import { HookFiringVersionConflictError } from '@integrations/domain/exceptions/hook-firing-version-conflict.error';
import type { HookFiringRepository } from '@integrations/domain/repositories/hook-firing.repository';
import { HookDecision } from '@integrations/domain/value-objects/hook-decision.vo';
import type { HookEventName } from '@integrations/domain/value-objects/hook-event.vo';
import { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';
import type { CausationPort } from '@shared-kernel/application/ports/causation.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { TaskNotesFromHooksPort } from '@work/application/ports/task-notes-from-hooks.port';

const WAIT_AGAIN_MS = 2_000;

const BEFORE_BUDGET_MS = 60_000;

const PURGE_BATCH = 500;

export interface Happened {
  readonly on: HookEventName;
  readonly occurrence: string;
  readonly change: string;
  readonly task: TaskView;
  readonly event: Readonly<Record<string, unknown>>;
  readonly matchedLater?: boolean;
}

interface LeasedFiring {
  firing: HookFiring;
}

const because = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const failed = (name: string, reason: string): StepResult => ({
  outcome: { name, status: 'failed', code: 'errored', reason, output: null },
  denyReason: null,
  trace: null,
});

const reasonOf = (outcome: StepOutcome): string =>
  outcome.status === 'failed' ? outcome.reason : 'had no answer in time';

class StepFailed extends Error {
  readonly failure: HookFailure;

  constructor(hook: string, step: string, failure: HookFailure) {
    super(`Hook ${hook} failed at step ${step}. Reason: ${failure.reason}`);
    this.name = 'StepFailed';
    this.failure = HookFailure.of(failure.code, this.message);
  }
}

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

export class FireHooks {
  constructor(
    private readonly runtime: HookRuntimePort,
    private readonly firings: HookFiringRepository,
    private readonly history: HookFiringHistoryPort,
    private readonly tasks: TasksForHooksPort,
    private readonly notes: TaskNotesFromHooksPort,
    private readonly calls: HookCallsPort,
    private readonly pullRequests: PullRequestPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly causation: CausationPort,
    private readonly logger: LoggerPort,
  ) {}

  async listens(teamId: string, on: HookEventName): Promise<boolean> {
    return (await this.runtime.listening(teamId, on)).length > 0;
  }

  async before(
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

    const budget = new Date(
      Math.min(
        until?.getTime() ?? Number.POSITIVE_INFINITY,
        instance.at.getTime() + BEFORE_BUDGET_MS,
      ),
    );

    for (const hook of await this.runtime.listening(task.teamId, on)) {
      if (hook.broken) {
        this.logger.warn(
          { hook: hook.key, reason: hook.broken },
          'A hook no longer reads as it was written',
        );

        const decision = HookDecision.onBrokenHook(
          hook.key,
          hook.broken,
          hook.blocks,
        );

        if (decision.denies) {
          return decision;
        }

        continue;
      }

      if (!this.runtime.matches(hook, instance)) {
        continue;
      }

      const decision = await this.ranBefore(hook, instance, budget);

      if (decision.denies) {
        return decision;
      }
    }

    return HookDecision.allowed();
  }

  async happened(happened: Happened): Promise<number> {
    const at = this.clock.now();
    const instance: HookEventInstance = {
      on: happened.on,
      occurrence: happened.occurrence,
      task: happened.task,
      event: happened.event,
      at,
      firing: null,
    };
    const matchedLater = happened.matchedLater === true;
    const change = {
      kind: 'event' as const,
      key: `${happened.on}:${happened.task.taskId}:${happened.change}`,
      description: `${happened.on} of ${happened.task.title}${happened.change ? ` (${happened.change})` : ''}`,
    };
    const cause = this.causation.current().followedBy(change);
    let fired = 0;

    for (const hook of await this.runtime.listening(
      happened.task.teamId,
      happened.on,
    )) {
      if (hook.broken) {
        this.logger.warn(
          { hook: hook.key, reason: hook.broken },
          'A hook no longer reads as it was written',
        );
        continue;
      }

      if (!matchedLater && !this.runtime.matches(hook, instance)) {
        continue;
      }

      const queued = await this.firings.add(
        HookFiring.fire({
          id: this.ids.generate(),
          hookId: hook.id,
          workspaceId: happened.task.workspaceId,
          teamId: happened.task.teamId,
          taskId: happened.task.taskId,
          runId: happened.task.runId,
          stationKey: happened.task.stationKey,
          on: happened.on,
          occurrence: happened.occurrence,
          firedAt: at,
          event: happened.event,
          matched: !matchedLater,
          cause,
          link: {
            kind: 'hook',
            key: `hook:${hook.id}:${change.key}`,
            description: `the hook ${hook.key}`,
          },
        }),
      );

      fired += queued ? 1 : 0;
    }

    return fired;
  }

  async workOne(): Promise<boolean> {
    const claimed = await this.firings.claimNext(this.clock.now());

    if (!claimed) {
      return false;
    }

    const leased: LeasedFiring = { firing: claimed };

    await unlessVersionConflict(async () => {
      try {
        await this.causation.within(
          claimed.cause.followedBy(claimed.link),
          () => this.delivered(leased),
        );
      } catch (error) {
        if (error instanceof HookFiringVersionConflictError) {
          throw error;
        }

        await this.recordFailure(
          leased.firing,
          error instanceof StepFailed
            ? error.failure
            : HookFailure.of('errored', because(error)),
        );
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

  async purgeFinished(): Promise<number> {
    const now = this.clock.now();
    const finished = await this.firings.finishedBefore(
      HookFiring.retentionCutoff(now),
      PURGE_BATCH,
    );

    for (const firing of finished) {
      await unlessVersionConflict(() => this.firings.save(firing.purge(now)));
    }

    return finished.length;
  }

  private async recordFailure(
    firing: HookFiring,
    failure: HookFailure,
  ): Promise<void> {
    const now = this.clock.now();
    const movedOn = firing.willRetry(failure, now)
      ? false
      : await this.notes.movedOn(firing.taskId, firing.stationKey);

    await this.firings.save(firing.failedWith(failure, now, movedOn));
  }

  private async stopped(
    leased: LeasedFiring,
    hook: string,
    loop: HookFailure,
  ): Promise<void> {
    if (!leased.firing.stoppedForLooping) {
      leased.firing = await this.saved(leased.firing.stopForLoop(loop));
    }

    const { firing } = leased;

    try {
      const notice = await this.notes.failed({
        taskId: firing.taskId,
        stationKey: firing.stationKey,
        hook,
        code: loop.code,
        reason: loop.reason,
        receivedAs: `loop:${firing.id}`,
      });

      this.logger.warn(
        { hook, task: firing.taskId, loop: loop.reason, notice },
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
        { err: error, hook, task: firing.taskId },
        'Could not yet send the notice of a hook stopped for looping',
      );
      await this.firings.save(
        firing.failedWith(
          HookFailure.of('errored', because(error)),
          this.clock.now(),
          false,
        ),
      );
    }
  }

  private async ranBefore(
    hook: ListeningHook,
    instance: HookEventInstance,
    until: Date,
  ): Promise<HookDecision> {
    const own = this.clock.now().getTime() + hook.timeoutSeconds * 1000;
    const deadline = new Date(Math.min(own, until.getTime()));
    const earlier: StepOutcome[] = [];

    for (const step of hook.steps) {
      const stepResult = await this.takeStep({
        hook,
        step,
        instance: instance,
        earlier,
        resuming: null,
        deadline,
        waitMode: 'wait',
      });

      await this.traced(instance, stepResult);
      earlier.push(stepResult.outcome);

      const failedBecause =
        stepResult.outcome.status === 'done'
          ? null
          : reasonOf(stepResult.outcome);

      if (failedBecause !== null && stepResult.denyReason === null) {
        this.logger.warn(
          { hook: hook.key, step, reason: failedBecause },
          'A hook before an event failed',
        );
      }

      const decision =
        hook.written?.decisionOn(step, {
          denyReason: stepResult.denyReason,
          failedBecause,
        }) ?? null;

      if (decision) {
        return decision;
      }
    }

    return HookDecision.allowed();
  }

  private async takeStep(stepRequest: StepRequest): Promise<StepResult> {
    try {
      return await this.runtime.step(stepRequest);
    } catch (error) {
      return failed(stepRequest.step, because(error));
    }
  }

  private async saved(firing: HookFiring): Promise<HookFiring> {
    await this.firings.save(firing);

    const reloaded = await this.firings.withId(firing.id);

    if (!reloaded) {
      throw new HookFiringVersionConflictError(firing.id);
    }

    return reloaded;
  }

  private async delivered(leased: LeasedFiring): Promise<void> {
    const { firing } = leased;
    const hook = await this.runtime.hook(firing.hookId);

    if (!hook) {
      await this.firings.save(firing.worked(this.clock.now()));
      return;
    }

    if (hook.broken) {
      await this.firings.save(
        firing.failedWith(
          HookFailure.of(
            'broken',
            `Hook ${hook.key} is broken. Reason: ${hook.broken}`,
          ),
          this.clock.now(),
          false,
        ),
      );
      return;
    }

    const task = await this.tasks.of(firing.taskId, firing.runId);

    if (!task) {
      await this.firings.save(
        firing.failedWith(
          HookFailure.of(
            'superseded',
            'The task of this hook firing no longer exists.',
          ),
          this.clock.now(),
          false,
        ),
      );
      return;
    }

    const instance = await this.eventInstanceOf(firing, task);

    if (!firing.matched) {
      if (!this.runtime.matches(hook, instance)) {
        await this.firings.save(firing.worked(this.clock.now()));
        return;
      }

      leased.firing = await this.saved(firing.recordMatch(instance.event));
    }

    const loop = leased.firing.loopStop(
      hook.key,
      await this.history.recentRepeats(leased.firing),
    );

    if (loop) {
      await this.stopped(leased, hook.key, loop);
      return;
    }

    const done = new Map(leased.firing.steps.map((step) => [step.name, step]));
    const earlier: StepOutcome[] = [];

    for (const step of hook.steps) {
      const before = done.get(step);

      if (before?.status === 'done') {
        earlier.push(before);
        continue;
      }

      const stepResult = await this.takeStep({
        hook,
        step,
        instance: instance,
        earlier,
        resuming: before?.status === 'waiting' ? before : null,
        deadline: new Date(
          this.clock.now().getTime() + hook.timeoutSeconds * 1000,
        ),
        waitMode: 'suspend',
      });

      if (stepResult.outcome.status === 'waiting') {
        const waiting = await this.saved(
          leased.firing.recordStep([...earlier, stepResult.outcome]),
        );

        await this.firings.save(
          waiting.waitUntil(
            new Date(this.clock.now().getTime() + WAIT_AGAIN_MS),
          ),
        );
        return;
      }

      await this.traced(instance, stepResult);

      if (stepResult.outcome.status === 'failed') {
        leased.firing = await this.saved(
          leased.firing.recordStep([...earlier, stepResult.outcome]),
        );
        throw new StepFailed(
          hook.key,
          step,
          HookFailure.of(stepResult.outcome.code, stepResult.outcome.reason),
        );
      }

      earlier.push(stepResult.outcome);
      leased.firing = await this.saved(leased.firing.recordStep(earlier));
    }

    await this.firings.save(leased.firing.worked(this.clock.now()));
  }

  private async eventInstanceOf(
    firing: HookFiring,
    task: TaskView,
  ): Promise<HookEventInstance> {
    const instance: HookEventInstance = {
      on: firing.on,
      occurrence: firing.occurrence,
      at: firing.firedAt,
      task,
      event: firing.event,
      firing: firing.id,
    };

    if (firing.matched || firing.on !== 'pull-request.merged') {
      return instance;
    }

    const url = String(firing.event.url ?? '');
    const repository = String(firing.event.repository ?? '');

    return {
      ...instance,
      event: {
        ...firing.event,
        changed: await this.pullRequests.changedIn(
          WorkspaceId.of(firing.workspaceId),
          Repository.of(repository),
          PullRequestUrl.of(url),
        ),
      },
    };
  }

  private async traced(
    instance: HookEventInstance,
    stepResult: StepResult,
  ): Promise<void> {
    if (!stepResult.trace || !instance.task.runId) {
      return;
    }

    try {
      await this.calls.record(instance.task.runId, stepResult.trace);
    } catch (error) {
      this.logger.warn(
        { err: error, run: instance.task.runId },
        'Could not trace a hook call',
      );
    }
  }
}
