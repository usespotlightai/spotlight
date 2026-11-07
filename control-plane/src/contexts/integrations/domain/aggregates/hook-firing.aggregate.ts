import { InvalidHookFiringTransitionError } from '@integrations/domain/exceptions/invalid-hook-firing-transition.error';
import { DELIVERING } from '@integrations/domain/services/delivery-retry';
import {
  loopStopFor,
  RECENT_MS,
} from '@integrations/domain/services/loop-guard';
import type {
  CausalChain,
  CauseLink,
} from '@integrations/domain/value-objects/causal-chain.vo';
import type { Hook } from '@integrations/domain/value-objects/hook.vo';
import type { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import {
  HookEvent,
  type HookEventName,
} from '@integrations/domain/value-objects/hook-event.vo';
import { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';
import type { HookFiringId } from '@integrations/domain/value-objects/hook-firing-id.vo';
import type {
  HookStepOutcome,
  WaitingHookStep,
} from '@integrations/domain/value-objects/hook-step-outcome.vo';
import { deepFrozen } from '@shared-kernel/domain/deep-frozen';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface NextHookStep {
  readonly name: string;
  readonly earlier: readonly HookStepOutcome[];
  readonly resuming: WaitingHookStep | null;
}

export type HookFiringProgress =
  | { readonly kind: 'pending'; readonly dueAt: Date }
  | { readonly kind: 'working'; readonly claimedAt: Date }
  | { readonly kind: 'done'; readonly at: Date }
  | { readonly kind: 'failed'; readonly at: Date }
  | { readonly kind: 'superseded'; readonly at: Date };

export type HookFiringState = HookFiringProgress['kind'];

export interface HookFiringRepeats {
  readonly hookId: HookDefinitionId;
  readonly taskId: TaskId;
  readonly linkKey: string;
  readonly since: Date;
  readonly before: { readonly firedAt: Date; readonly id: HookFiringId };
}

export const HOOK_FIRING_STATES = [
  'pending',
  'working',
  'done',
  'failed',
  'superseded',
] as const satisfies readonly HookFiringState[];

interface Fired {
  readonly id: HookFiringId;
  readonly hookId: HookDefinitionId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly taskId: TaskId;
  readonly runId: RunId | null;
  readonly stationKey: StationKey;
  readonly on: HookEventName;
  readonly occurrence: string;
  readonly firedAt: Date;
  readonly event: Readonly<Record<string, unknown>>;
  readonly matched: boolean;
  readonly cause: CausalChain;
  readonly link: CauseLink;
}

interface State extends Fired {
  readonly steps: readonly HookStepOutcome[];
  readonly progress: HookFiringProgress;
  readonly attempts: number;
  readonly failure: HookFailure | null;
  readonly version: number;
}

const LEASE_MS = 10 * 60 * 1000;

const WAIT_AGAIN_MS = 2_000;

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const frozenEvent = (
  event: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> => deepFrozen(structuredClone(event));

const impossibleTrail = (steps: readonly HookStepOutcome[]): string | null => {
  const names = new Set(steps.map((step) => step.name));

  if (names.size !== steps.length) {
    return 'takes a step twice';
  }

  const unfinished = steps.slice(0, -1).find((step) => step.status !== 'done');

  return unfinished
    ? `took a step after ${unfinished.name} ended ${unfinished.status}`
    : null;
};

const isLoop = (failure: HookFailure | null): failure is HookFailure =>
  failure?.code === 'loop';

export class HookFiring extends EventRecorder {
  private constructor(
    private readonly state: State,
    readonly isDiscarded = false,
  ) {
    super();
  }

  static fire(input: Fired): HookFiring {
    return new HookFiring({
      ...input,
      event: frozenEvent(input.event),
      steps: [],
      progress: { kind: 'pending', dueAt: input.firedAt },
      attempts: 0,
      failure: null,
      version: 0,
    });
  }

  static rehydrate(state: State): HookFiring {
    if (!Number.isInteger(state.version) || state.version < 1) {
      throw new InconsistentStateError(
        'hook firing',
        `has an impossible version (${state.version})`,
      );
    }

    if (!Number.isInteger(state.attempts) || state.attempts < 0) {
      throw new InconsistentStateError(
        'hook firing',
        `was attempted ${state.attempts} times`,
      );
    }

    const trail = impossibleTrail(state.steps);

    if (trail) {
      throw new InconsistentStateError(
        'hook firing',
        `${trail} (${state.id.value})`,
      );
    }

    if (state.progress.kind === 'failed' && state.failure === null) {
      throw new InconsistentStateError(
        'hook firing',
        `failed for no reason (${state.id.value})`,
      );
    }

    if (
      state.progress.kind === 'superseded' &&
      state.failure?.code !== 'superseded'
    ) {
      throw new InconsistentStateError(
        'hook firing',
        `was superseded without saying so (${state.id.value})`,
      );
    }

    return new HookFiring({ ...state, event: frozenEvent(state.event) });
  }

  static leaseExpiredBefore(now: Date): Date {
    return new Date(now.getTime() - LEASE_MS);
  }

  static retentionCutoff(now: Date): Date {
    return new Date(now.getTime() - RETENTION_MS);
  }

  get id(): HookFiringId {
    return this.state.id;
  }

  get hookId(): HookDefinitionId {
    return this.state.hookId;
  }

  get workspaceId(): WorkspaceId {
    return this.state.workspaceId;
  }

  get teamId(): TeamId {
    return this.state.teamId;
  }

  get taskId(): TaskId {
    return this.state.taskId;
  }

  get runId(): RunId | null {
    return this.state.runId;
  }

  get stationKey(): StationKey {
    return this.state.stationKey;
  }

  get on(): HookEventName {
    return this.state.on;
  }

  get occurrence(): string {
    return this.state.occurrence;
  }

  get firedAt(): Date {
    return this.state.firedAt;
  }

  get event(): Readonly<Record<string, unknown>> {
    return this.state.event;
  }

  get matched(): boolean {
    return this.state.matched;
  }

  get cause(): CausalChain {
    return this.state.cause;
  }

  get link(): CauseLink {
    return this.state.link;
  }

  get steps(): readonly HookStepOutcome[] {
    return this.state.steps;
  }

  get progress(): HookFiringProgress {
    return this.state.progress;
  }

  get attempts(): number {
    return this.state.attempts;
  }

  get failure(): HookFailure | null {
    return this.state.failure;
  }

  get version(): number {
    return this.state.version;
  }

  get isNew(): boolean {
    return this.state.version === 0;
  }

  get finished(): boolean {
    const { kind } = this.state.progress;

    return kind === 'done' || kind === 'failed' || kind === 'superseded';
  }

  get finishedAt(): Date | null {
    const { progress } = this.state;

    return progress.kind === 'pending' || progress.kind === 'working'
      ? null
      : progress.at;
  }

  get stoppedForLooping(): boolean {
    return isLoop(this.state.failure);
  }

  get repeatsCountedSince(): Date {
    return new Date(this.state.firedAt.getTime() - RECENT_MS);
  }

  get repeatsOf(): HookFiringRepeats {
    return {
      hookId: this.state.hookId,
      taskId: this.state.taskId,
      linkKey: this.state.link.key,
      since: this.repeatsCountedSince,
      before: { firedAt: this.state.firedAt, id: this.state.id },
    };
  }

  get changesToRead(): {
    readonly repository: Repository;
    readonly pullRequest: PullRequestUrl;
  } | null {
    if (
      this.state.matched ||
      !HookEvent.of(this.state.on).matchedAfterChanges
    ) {
      return null;
    }

    return {
      repository: Repository.of(String(this.state.event.repository ?? '')),
      pullRequest: PullRequestUrl.of(String(this.state.event.url ?? '')),
    };
  }

  eventWithChanges(
    changed: readonly string[],
  ): Readonly<Record<string, unknown>> {
    return { ...this.state.event, changed: [...changed] };
  }

  claimed(now: Date): HookFiring {
    const { progress } = this.state;
    const due =
      progress.kind === 'pending' && progress.dueAt.getTime() <= now.getTime();
    const leaseExpired =
      progress.kind === 'working' &&
      progress.claimedAt.getTime() <
        HookFiring.leaseExpiredBefore(now).getTime();

    if (!due && !leaseExpired) {
      throw new InvalidHookFiringTransitionError(
        progress.kind === 'working'
          ? 'is still claimed'
          : `cannot be claimed while ${progress.kind}`,
      );
    }

    return this.with({ progress: { kind: 'working', claimedAt: now } });
  }

  nextStepOf(hook: Hook): NextHookStep | null {
    const taken = new Map(this.state.steps.map((step) => [step.name, step]));
    const earlier: HookStepOutcome[] = [];

    for (const { name } of hook.steps) {
      const before = taken.get(name);

      if (before?.status === 'done') {
        earlier.push(before);
        continue;
      }

      return {
        name,
        earlier,
        resuming: before?.status === 'waiting' ? before : null,
      };
    }

    return null;
  }

  stepTaken(hook: Hook, outcome: HookStepOutcome, now: Date): HookFiring {
    this.guardWorking('take a step');

    const next = this.nextStepOf(hook);

    if (next === null || next.name !== outcome.name) {
      throw new InvalidHookFiringTransitionError(
        `cannot take step ${outcome.name} now${next ? `. Step ${next.name} comes first` : '. Every step is done'}`,
      );
    }

    if (
      next.resuming !== null &&
      outcome.status === 'waiting' &&
      outcome.call !== next.resuming.call
    ) {
      throw new InvalidHookFiringTransitionError(
        `cannot wait on a second call at step ${outcome.name}`,
      );
    }

    const steps = [
      ...next.earlier,
      { ...outcome },
      ...(outcome.status === 'done' ? this.doneAfter(hook, outcome.name) : []),
    ];

    return outcome.status === 'waiting'
      ? this.with({
          steps,
          progress: {
            kind: 'pending',
            dueAt: new Date(now.getTime() + WAIT_AGAIN_MS),
          },
        })
      : this.with({ steps });
  }

  recordMatch(event: Readonly<Record<string, unknown>>): HookFiring {
    this.guardWorking('be matched');

    if (this.state.matched) {
      throw new InvalidHookFiringTransitionError('was already matched');
    }

    return this.with({ event: frozenEvent(event), matched: true });
  }

  hookBroken(hook: string, reason: string, now: Date): HookFiring {
    return this.failedWith(
      HookFailure.of('broken', `Hook ${hook} is broken. Reason: ${reason}`),
      now,
      false,
    );
  }

  taskGone(now: Date): HookFiring {
    return this.failedWith(
      HookFailure.of(
        'superseded',
        'The task of this hook firing no longer exists.',
      ),
      now,
      false,
    );
  }

  loopStop(hook: string, recentRepeats: number): HookFailure | null {
    if (isLoop(this.state.failure)) {
      return this.state.failure;
    }

    if (this.state.steps.length > 0) {
      return null;
    }

    const stop = loopStopFor({
      chain: this.state.cause,
      firing: this.state.link,
      recentRepeats,
    });

    return stop
      ? HookFailure.of(
          'loop',
          `Hook ${hook} was stopped to prevent a loop. ${stop.description}`,
        )
      : null;
  }

  stopForLoop(loop: HookFailure): HookFiring {
    this.guardWorking('be stopped');

    if (loop.code !== 'loop') {
      throw new InvalidHookFiringTransitionError(
        `cannot be stopped for a loop by a ${loop.code} failure`,
      );
    }

    if (isLoop(this.state.failure)) {
      return this;
    }

    return this.with({ failure: loop });
  }

  markLoopNotified(now: Date, superseded: boolean): HookFiring {
    this.guardWorking('be marked as notified of a loop');

    const loop = this.state.failure;

    if (!isLoop(loop)) {
      throw new InvalidHookFiringTransitionError(
        'cannot be reported as a loop before it is stopped for one',
      );
    }

    return this.ended(superseded ? loop.superseded() : loop, now);
  }

  willRetry(failure: HookFailure, now: Date): boolean {
    return this.retryOf(failure, now).at !== null;
  }

  failedWith(
    failure: HookFailure,
    now: Date,
    taskMovedOn: boolean,
  ): HookFiring {
    this.guardWorking('fail');

    const { recorded, at } = this.retryOf(failure, now);

    if (at) {
      return this.with({
        progress: { kind: 'pending', dueAt: at },
        attempts: this.state.attempts + 1,
        failure: recorded,
      });
    }

    return this.ended(
      taskMovedOn && recorded === failure ? failure.superseded() : recorded,
      now,
    );
  }

  worked(now: Date): HookFiring {
    this.guardWorking('be worked');

    return this.with({
      progress: { kind: 'done', at: now },
      attempts: this.state.attempts + 1,
    });
  }

  isPastRetention(now: Date): boolean {
    const at = this.finishedAt;

    return at !== null && at.getTime() + RETENTION_MS <= now.getTime();
  }

  purge(now: Date): HookFiring {
    if (!this.isPastRetention(now)) {
      throw new InvalidHookFiringTransitionError(
        'is stored for 30 days after it finishes',
      );
    }

    const purged = new HookFiring(this.state, true);
    purged.inheritEvents(this);

    return purged;
  }

  private doneAfter(hook: Hook, step: string): HookStepOutcome[] {
    const names = hook.steps.map((each) => each.name);
    const taken = new Map(this.state.steps.map((each) => [each.name, each]));

    return names.slice(names.indexOf(step) + 1).flatMap((name) => {
      const before = taken.get(name);

      return before?.status === 'done' ? [before] : [];
    });
  }

  private retryOf(
    failure: HookFailure,
    now: Date,
  ): { readonly recorded: HookFailure; readonly at: Date | null } {
    const attempts = this.state.attempts + 1;
    const loop = this.state.failure;

    return isLoop(loop) && failure.retry.allowsRetry
      ? { recorded: loop, at: DELIVERING.nextAttemptAt(attempts, now) }
      : { recorded: failure, at: failure.nextAttemptAfter(attempts, now) };
  }

  private ended(failure: HookFailure, now: Date): HookFiring {
    return this.with({
      progress: {
        kind: failure.code === 'superseded' ? 'superseded' : 'failed',
        at: now,
      },
      attempts: this.state.attempts + 1,
      failure,
    });
  }

  private guardWorking(doing: string): void {
    const { kind } = this.state.progress;

    if (kind !== 'working') {
      throw new InvalidHookFiringTransitionError(
        `cannot ${doing} while ${kind}`,
      );
    }
  }

  private with(part: Partial<State>): HookFiring {
    const next = new HookFiring({ ...this.state, ...part }, this.isDiscarded);

    next.inheritEvents(this);

    return next;
  }
}
