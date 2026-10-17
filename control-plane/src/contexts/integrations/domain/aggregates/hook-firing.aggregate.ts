import { InvalidHookFiringTransitionError } from '@integrations/domain/exceptions/invalid-hook-firing-transition.error';
import { DELIVERING } from '@integrations/domain/services/delivery-retry';
import {
  loopStopFor,
  RECENT_MS,
} from '@integrations/domain/services/loop-guard';
import type { HookEventName } from '@integrations/domain/value-objects/hook-event.vo';
import {
  HookFailure,
  type HookFailureCode,
} from '@integrations/domain/value-objects/hook-failure.vo';
import { deepFrozen } from '@shared-kernel/domain/deep-frozen';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type {
  CausalChain,
  CauseLink,
} from '@shared-kernel/domain/value-objects/causal-chain.vo';

export type HookStepOutcome =
  | {
      readonly name: string;
      readonly status: 'done';
      readonly output: unknown;
    }
  | {
      readonly name: string;
      readonly status: 'failed';
      readonly code: HookFailureCode;
      readonly reason: string;
      readonly output: unknown;
    }
  | {
      readonly name: string;
      readonly status: 'waiting';
      readonly call: string;
      readonly until: string;
    };

export type HookFiringProgress =
  | { readonly kind: 'pending'; readonly dueAt: Date }
  | { readonly kind: 'working'; readonly claimedAt: Date }
  | { readonly kind: 'done'; readonly at: Date }
  | { readonly kind: 'failed'; readonly at: Date }
  | { readonly kind: 'superseded'; readonly at: Date };

export type HookFiringState = HookFiringProgress['kind'];

interface Fired {
  readonly id: string;
  readonly hookId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly taskId: string;
  readonly runId: string | null;
  readonly stationKey: string;
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

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const frozenEvent = (
  event: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> => deepFrozen(structuredClone(event));

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

    if (state.progress.kind === 'failed' && state.failure === null) {
      throw new InconsistentStateError(
        'hook firing',
        `failed for no reason (${state.id})`,
      );
    }

    if (
      state.progress.kind === 'superseded' &&
      state.failure?.code !== 'superseded'
    ) {
      throw new InconsistentStateError(
        'hook firing',
        `was superseded without saying so (${state.id})`,
      );
    }

    return new HookFiring({ ...state, event: frozenEvent(state.event) });
  }

  static leaseLapsedBefore(now: Date): Date {
    return new Date(now.getTime() - LEASE_MS);
  }

  static finishedForgettablyBefore(now: Date): Date {
    return new Date(now.getTime() - RETENTION_MS);
  }

  get id(): string {
    return this.state.id;
  }

  get hookId(): string {
    return this.state.hookId;
  }

  get workspaceId(): string {
    return this.state.workspaceId;
  }

  get teamId(): string {
    return this.state.teamId;
  }

  get taskId(): string {
    return this.state.taskId;
  }

  get runId(): string | null {
    return this.state.runId;
  }

  get stationKey(): string {
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

  claimed(now: Date): HookFiring {
    const { progress } = this.state;
    const due =
      progress.kind === 'pending' && progress.dueAt.getTime() <= now.getTime();
    const lapsed =
      progress.kind === 'working' &&
      progress.claimedAt.getTime() <
        HookFiring.leaseLapsedBefore(now).getTime();

    if (!due && !lapsed) {
      throw new InvalidHookFiringTransitionError(
        progress.kind === 'working'
          ? 'is still claimed'
          : `cannot be claimed while ${progress.kind}`,
      );
    }

    return this.with({ progress: { kind: 'working', claimedAt: now } });
  }

  recordStep(steps: readonly HookStepOutcome[]): HookFiring {
    this.guardWorking('take a step');

    return this.with({ steps: steps.map((each) => ({ ...each })) });
  }

  recordMatch(event: Readonly<Record<string, unknown>>): HookFiring {
    this.guardWorking('be matched');

    if (this.state.matched) {
      throw new InvalidHookFiringTransitionError('was already matched');
    }

    return this.with({ event: frozenEvent(event), matched: true });
  }

  waitUntil(at: Date): HookFiring {
    this.guardWorking('wait');

    return this.with({ progress: { kind: 'pending', dueAt: at } });
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
          `Hook ${hook} was stopped to prevent a loop. ${stop.saying}`,
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

  toldOfLoop(now: Date, superseded: boolean): HookFiring {
    this.guardWorking('be told of');

    const loop = this.state.failure;

    if (!isLoop(loop)) {
      throw new InvalidHookFiringTransitionError(
        'cannot be reported as a loop before it is stopped for one',
      );
    }

    return this.ended(superseded ? loop.superseded() : loop, now);
  }

  retries(failure: HookFailure, now: Date): boolean {
    return this.retryOf(failure, now).at !== null;
  }

  failedWith(
    failure: HookFailure,
    now: Date,
    taskMovedOn: boolean,
  ): HookFiring {
    this.guardWorking('fail');

    const { kept, at } = this.retryOf(failure, now);

    if (at) {
      return this.with({
        progress: { kind: 'pending', dueAt: at },
        attempts: this.state.attempts + 1,
        failure: kept,
      });
    }

    return this.ended(
      taskMovedOn && kept === failure ? failure.superseded() : kept,
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

  isForgettableAt(now: Date): boolean {
    const at = this.finishedAt;

    return at !== null && at.getTime() + RETENTION_MS <= now.getTime();
  }

  forgotten(now: Date): HookFiring {
    if (!this.isForgettableAt(now)) {
      throw new InvalidHookFiringTransitionError(
        'is kept for 30 days after it finishes',
      );
    }

    const forgotten = new HookFiring(this.state, true);
    forgotten.inheritEvents(this);

    return forgotten;
  }

  private retryOf(
    failure: HookFailure,
    now: Date,
  ): { readonly kept: HookFailure; readonly at: Date | null } {
    const attempts = this.state.attempts + 1;
    const loop = this.state.failure;

    return isLoop(loop) && failure.retry.retries
      ? { kept: loop, at: DELIVERING.after(attempts, now) }
      : { kept: failure, at: failure.nextAttemptAfter(attempts, now) };
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
