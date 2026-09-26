import type { PullRequestPort } from '@github/application/ports/pull-request.port';
import type {
  HookFiringsPort,
  StoredFiring,
} from '@integrations/application/ports/hook-firings.port';
import type {
  HookMoment,
  HookRuntimePort,
  ListeningHook,
  StepAsked,
  StepOutcome,
  StepTaken,
} from '@integrations/application/ports/hook-runtime.port';
import { nextDeliveryAttempt } from '@integrations/domain/services/delivery-retry';
import {
  loopStopFor,
  RECENT_MS,
} from '@integrations/domain/services/loop-guard';
import type { HookEventName } from '@integrations/domain/value-objects/hook-event.vo';
import { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';
import type { CausationPort } from '@shared-kernel/application/ports/causation.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { HookTracesPort } from '@work/application/ports/hook-traces.port';
import type {
  HookedTaskDto,
  HookedTasksPort,
} from '@work/application/ports/hooked-tasks.port';
import type { HookVerdict } from '@work/application/ports/lifecycle-hooks.port';
import type { TaskNotesFromHooksPort } from '@work/application/ports/task-notes-from-hooks.port';

const WAIT_AGAIN_MS = 2_000;

const BEFORE_BUDGET_MS = 60_000;

const KEPT_FOR_MS = 30 * 24 * 60 * 60 * 1000;

const FORGOTTEN_AT_ONCE = 500;

const ALLOWED: HookVerdict = { kind: 'allowed' };

export interface Happened {
  readonly on: HookEventName;
  readonly occurrence: string;
  readonly change: string;
  readonly task: HookedTaskDto;
  readonly event: Readonly<Record<string, unknown>>;
  readonly matchedLater?: boolean;
}

const because = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const failed = (name: string, reason: string): StepTaken => ({
  outcome: { name, status: 'failed', code: 'errored', reason, output: null },
  refusal: null,
  trace: null,
});

const reasonOf = (outcome: StepOutcome): string =>
  outcome.status === 'failed' ? outcome.reason : 'had no answer in time';

class StepFailed extends Error {
  readonly failure: HookFailure;

  constructor(hook: string, step: string, failure: HookFailure) {
    super(`The hook ${hook} failed at ${step}: ${failure.reason}`);
    this.name = 'StepFailed';
    this.failure = HookFailure.of(failure.code, this.message);
  }
}

export class HookFirings {
  constructor(
    private readonly runtime: HookRuntimePort,
    private readonly firings: HookFiringsPort,
    private readonly tasks: HookedTasksPort,
    private readonly notes: TaskNotesFromHooksPort,
    private readonly traces: HookTracesPort,
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
    task: HookedTaskDto,
    on: HookEventName,
    event: Readonly<Record<string, unknown>>,
    until: Date | null = null,
  ): Promise<HookVerdict> {
    const moment: HookMoment = {
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
        moment.at.getTime() + BEFORE_BUDGET_MS,
      ),
    );

    for (const hook of await this.runtime.listening(task.teamId, on)) {
      if (hook.broken) {
        this.logger.warn(
          { hook: hook.key, reason: hook.broken },
          'A hook no longer reads as it was written',
        );

        if (hook.blocks) {
          return {
            kind: 'refused',
            reason: `The hook ${hook.key} no longer reads as it was written (${hook.broken}), and it blocks on failure`,
          };
        }

        continue;
      }

      if (!this.runtime.matches(hook, moment)) {
        continue;
      }

      const refused = await this.ranBefore(hook, moment, budget);

      if (refused) {
        return { kind: 'refused', reason: refused };
      }
    }

    return ALLOWED;
  }

  async happened(happened: Happened): Promise<number> {
    const moment: HookMoment = {
      on: happened.on,
      occurrence: happened.occurrence,
      task: happened.task,
      event: happened.event,
      at: this.clock.now(),
      firing: null,
    };
    const matchedLater = happened.matchedLater === true;
    const change = {
      kind: 'event' as const,
      key: `${happened.on}:${happened.task.taskId}:${happened.change}`,
      saying: `${happened.on} of ${happened.task.title}${happened.change ? ` (${happened.change})` : ''}`,
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

      if (!matchedLater && !this.runtime.matches(hook, moment)) {
        continue;
      }

      const queued = await this.firings.fire({
        id: this.ids.generate(),
        hookId: hook.id,
        workspaceId: happened.task.workspaceId,
        teamId: happened.task.teamId,
        taskId: happened.task.taskId,
        runId: happened.task.runId,
        stationKey: happened.task.stationKey,
        on: happened.on,
        occurrence: happened.occurrence,
        at: moment.at,
        event: happened.event,
        matched: !matchedLater,
        cause,
        link: {
          kind: 'hook',
          key: `hook:${hook.id}:${change.key}`,
          saying: `the hook ${hook.key}`,
        },
      });

      fired += queued ? 1 : 0;
    }

    return fired;
  }

  async workOne(): Promise<boolean> {
    const firing = await this.firings.claimNext(this.clock.now());

    if (!firing) {
      return false;
    }

    try {
      await this.causation.within(firing.cause.followedBy(firing.link), () =>
        this.delivered(firing),
      );
    } catch (error) {
      await this.settled(
        firing,
        error instanceof StepFailed
          ? error.failure
          : HookFailure.of('errored', because(error)),
      );
    }

    return true;
  }

  private async settled(
    firing: StoredFiring,
    failure: HookFailure,
  ): Promise<void> {
    if (firing.failure?.code === 'loop') {
      await this.reportAgain(firing, firing.failure);
      return;
    }

    const now = this.clock.now();
    const again = failure.nextAttemptAfter(firing.attempts + 1, now);

    if (again) {
      await this.firings.retryAt(firing, failure, again);
      return;
    }

    const movedOn = await this.notes.movedOn(firing.taskId, firing.stationKey);

    await this.firings.failed(
      firing,
      movedOn ? failure.superseded() : failure,
      now,
    );
  }

  private async loopOf(
    firing: StoredFiring,
    hook: string,
  ): Promise<HookFailure | null> {
    if (firing.failure?.code === 'loop') {
      return firing.failure;
    }

    if (firing.steps.length > 0) {
      return null;
    }

    const stop = loopStopFor({
      chain: firing.cause,
      firing: firing.link,
      recentRepeats: await this.firings.recentRepeats(
        firing,
        new Date(firing.at.getTime() - RECENT_MS),
      ),
    });

    return stop
      ? HookFailure.of('loop', `The hook ${hook} was stopped: ${stop.saying}`)
      : null;
  }

  private async stopped(
    firing: StoredFiring,
    hook: string,
    loop: HookFailure,
  ): Promise<void> {
    if (
      firing.failure?.code !== 'loop' &&
      !(await this.firings.stopping(firing, loop))
    ) {
      return;
    }

    try {
      const heard = await this.notes.failed({
        taskId: firing.taskId,
        stationKey: firing.stationKey,
        hook,
        code: loop.code,
        saying: loop.reason,
        heardAs: `loop:${firing.id}`,
      });

      this.logger.warn(
        { hook, task: firing.taskId, loop: loop.reason, heard },
        'Stopped a hook that would loop',
      );

      await this.firings.failed(
        firing,
        heard === 'reported' ? loop : loop.superseded(),
        this.clock.now(),
      );
    } catch (error) {
      this.logger.warn(
        { err: error, hook, task: firing.taskId },
        'Could not yet tell of a hook stopped for looping',
      );
      await this.reportAgain(firing, loop);
    }
  }

  private async reportAgain(
    firing: StoredFiring,
    loop: HookFailure,
  ): Promise<void> {
    const now = this.clock.now();
    const again = nextDeliveryAttempt(firing.attempts + 1, now);

    if (again) {
      await this.firings.retryAt(firing, loop, again);
    } else {
      await this.firings.failed(firing, loop, now);
    }
  }

  async workOff(limit = 50): Promise<number> {
    let worked = 0;

    while (worked < limit && (await this.workOne())) {
      worked += 1;
    }

    return worked;
  }

  forgetFinished(): Promise<number> {
    return this.firings.forgetFinished(
      new Date(this.clock.now().getTime() - KEPT_FOR_MS),
      FORGOTTEN_AT_ONCE,
    );
  }

  private async ranBefore(
    hook: ListeningHook,
    moment: HookMoment,
    until: Date,
  ): Promise<string | null> {
    const own = this.clock.now().getTime() + hook.timeoutSeconds * 1000;
    const deadline = new Date(Math.min(own, until.getTime()));
    const earlier: StepOutcome[] = [];

    for (const step of hook.steps) {
      const taken = await this.taken({
        hook,
        step,
        moment,
        earlier,
        resuming: null,
        deadline,
        waiting: 'until-answered',
      });

      await this.traced(moment, taken);
      earlier.push(taken.outcome);

      if (taken.refusal) {
        return `The hook ${hook.key} refused: ${taken.refusal}`;
      }

      if (taken.outcome.status !== 'done') {
        const reason = reasonOf(taken.outcome);

        this.logger.warn(
          { hook: hook.key, step, reason },
          'A hook before an event failed',
        );

        return hook.blocks
          ? `The hook ${hook.key} failed at ${step} (${reason}), and it blocks on failure`
          : null;
      }
    }

    return null;
  }

  private async taken(asked: StepAsked): Promise<StepTaken> {
    try {
      return await this.runtime.step(asked);
    } catch (error) {
      return failed(asked.step, because(error));
    }
  }

  private async delivered(firing: StoredFiring): Promise<void> {
    const hook = await this.runtime.hook(firing.hookId);

    if (!hook) {
      await this.firings.worked(firing, this.clock.now());
      return;
    }

    if (hook.broken) {
      await this.firings.failed(
        firing,
        HookFailure.of(
          'broken',
          `The hook ${hook.key} no longer reads as it was written: ${hook.broken}`,
        ),
        this.clock.now(),
      );
      return;
    }

    const task = await this.tasks.of(firing.taskId, firing.runId);

    if (!task) {
      await this.firings.failed(
        firing,
        HookFailure.of(
          'superseded',
          'its task is gone, so there is nothing to tell about',
        ),
        this.clock.now(),
      );
      return;
    }

    const moment = await this.momentOf(firing, task);

    if (!firing.matched) {
      if (!this.runtime.matches(hook, moment)) {
        await this.firings.worked(firing, this.clock.now());
        return;
      }

      if (!(await this.firings.matched(firing, moment.event))) {
        return;
      }
    }

    const loop = await this.loopOf(firing, hook.key);

    if (loop) {
      await this.stopped(firing, hook.key, loop);
      return;
    }

    const held = new Map(firing.steps.map((step) => [step.name, step]));
    const earlier: StepOutcome[] = [];

    for (const step of hook.steps) {
      const before = held.get(step);

      if (before?.status === 'done') {
        earlier.push(before);
        continue;
      }

      const taken = await this.taken({
        hook,
        step,
        moment,
        earlier,
        resuming: before?.status === 'waiting' ? before : null,
        deadline: new Date(
          this.clock.now().getTime() + hook.timeoutSeconds * 1000,
        ),
        waiting: 'hand-back',
      });

      if (taken.outcome.status === 'waiting') {
        await this.firings.stepped(firing, [...earlier, taken.outcome]);
        await this.firings.waitAt(
          firing,
          new Date(this.clock.now().getTime() + WAIT_AGAIN_MS),
        );
        return;
      }

      await this.traced(moment, taken);

      if (taken.outcome.status === 'failed') {
        await this.firings.stepped(firing, [...earlier, taken.outcome]);
        throw new StepFailed(
          hook.key,
          step,
          HookFailure.of(taken.outcome.code, taken.outcome.reason),
        );
      }

      earlier.push(taken.outcome);

      if (!(await this.firings.stepped(firing, earlier))) {
        return;
      }
    }

    await this.firings.worked(firing, this.clock.now());
  }

  private async momentOf(
    firing: StoredFiring,
    task: HookedTaskDto,
  ): Promise<HookMoment> {
    const moment: HookMoment = {
      on: firing.on,
      occurrence: firing.occurrence,
      at: firing.at,
      task,
      event: firing.event,
      firing: firing.id,
    };

    if (firing.matched || firing.on !== 'pull-request.merged') {
      return moment;
    }

    const url = String(firing.event.url ?? '');
    const repository = String(firing.event.repository ?? '');

    return {
      ...moment,
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

  private async traced(moment: HookMoment, taken: StepTaken): Promise<void> {
    if (!taken.trace || !moment.task.runId) {
      return;
    }

    try {
      await this.traces.record(moment.task.runId, taken.trace);
    } catch (error) {
      this.logger.warn(
        { err: error, run: moment.task.runId },
        'Could not trace a hook call',
      );
    }
  }
}
