import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { InvalidNetworkCallError } from '@work/domain/exceptions/invalid-network-call.error';
import { InvalidNetworkCallTransitionError } from '@work/domain/exceptions/invalid-network-call-transition.error';
import { NotThisHostsCallError } from '@work/domain/exceptions/not-this-hosts-call.error';
import type { CallingHost } from '@work/domain/value-objects/calling-host.vo';
import type { NetworkAnswer } from '@work/domain/value-objects/network-answer.vo';
import type { NetworkCallId } from '@work/domain/value-objects/network-call-id.vo';
import type { NetworkRequest } from '@work/domain/value-objects/network-request.vo';

export type NetworkCallProgress =
  | { readonly kind: 'waiting' }
  | { readonly kind: 'claimed'; readonly by: CallingHost; readonly at: Date }
  | {
      readonly kind: 'answered';
      readonly by: CallingHost;
      readonly claimedAt: Date;
      readonly at: Date;
      readonly answer: NetworkAnswer;
    }
  | { readonly kind: 'lapsed'; readonly at: Date }
  | { readonly kind: 'given-up'; readonly at: Date };

export type NetworkCallState = NetworkCallProgress['kind'];

interface State {
  readonly id: NetworkCallId;
  readonly workspaceId: WorkspaceId;
  readonly request: NetworkRequest;
  readonly queuedAt: Date;
  readonly lapsesAt: Date;
  readonly progress: NetworkCallProgress;
  readonly version: number;
}

const KEPT_MS = 7 * 24 * 60 * 60_000;

const givenUp = (id: string): string =>
  `Network call ${id} was given up. The hook stopped waiting for it.`;

export class NetworkCall extends EventRecorder {
  private constructor(
    private readonly state: State,
    readonly isDiscarded = false,
  ) {
    super();
  }

  static queue(input: {
    id: NetworkCallId;
    workspaceId: WorkspaceId;
    request: NetworkRequest;
    lapsesAt: Date;
    now: Date;
  }): NetworkCall {
    if (input.lapsesAt.getTime() <= input.now.getTime()) {
      throw new InvalidNetworkCallError(
        'must give a host time to send it before it lapses',
      );
    }

    return new NetworkCall({
      id: input.id,
      workspaceId: input.workspaceId,
      request: input.request,
      queuedAt: input.now,
      lapsesAt: input.lapsesAt,
      progress: { kind: 'waiting' },
      version: 0,
    });
  }

  static rehydrate(state: State): NetworkCall {
    if (!Number.isInteger(state.version) || state.version < 0) {
      throw new InconsistentStateError(
        'network call',
        `has an impossible version (${state.version})`,
      );
    }

    if (
      state.progress.kind !== 'waiting' &&
      state.progress.kind !== 'claimed' &&
      !state.request.isSpent
    ) {
      throw new InconsistentStateError(
        'network call',
        'still has what it sent once it was settled',
      );
    }

    if (state.lapsesAt < state.queuedAt) {
      throw new InconsistentStateError(
        'network call',
        'lapses before it was queued',
      );
    }

    return new NetworkCall(state);
  }

  get id(): NetworkCallId {
    return this.state.id;
  }

  get workspaceId(): WorkspaceId {
    return this.state.workspaceId;
  }

  get request(): NetworkRequest {
    return this.state.request;
  }

  get queuedAt(): Date {
    return this.state.queuedAt;
  }

  get lapsesAt(): Date {
    return this.state.lapsesAt;
  }

  get progress(): NetworkCallProgress {
    return this.state.progress;
  }

  get version(): number {
    return this.state.version;
  }

  get answer(): NetworkAnswer | null {
    return this.state.progress.kind === 'answered'
      ? this.state.progress.answer
      : null;
  }

  stateAt(now: Date): NetworkCallState {
    const { kind } = this.state.progress;

    return (kind === 'waiting' || kind === 'claimed') && this.lapsedAt(now)
      ? 'lapsed'
      : kind;
  }

  get settled(): boolean {
    return this.settledAt !== null;
  }

  get settledAt(): Date | null {
    const { progress } = this.state;

    return progress.kind === 'waiting' || progress.kind === 'claimed'
      ? null
      : progress.at;
  }

  static settledForgettablyBy(now: Date): Date {
    return new Date(now.getTime() - KEPT_MS);
  }

  isForgettableAt(now: Date): boolean {
    const settledAt = this.settledAt;

    return settledAt !== null && now.getTime() >= settledAt.getTime() + KEPT_MS;
  }

  forgotten(now: Date): NetworkCall {
    if (!this.isForgettableAt(now)) {
      throw new InvalidNetworkCallTransitionError(
        `Network call ${this.state.id.value} is kept for a week after it settles.`,
      );
    }

    const forgotten = new NetworkCall(this.state, true);
    forgotten.inheritEvents(this);

    return forgotten;
  }

  belongsTo(workspaceId: WorkspaceId): boolean {
    return this.state.workspaceId.equals(workspaceId);
  }

  claimedBy(host: CallingHost, now: Date): NetworkCall {
    const phase = this.stateAt(now);

    if (phase === 'given-up') {
      throw new InvalidNetworkCallTransitionError(givenUp(this.state.id.value));
    }

    if (phase !== 'waiting') {
      throw new InvalidNetworkCallTransitionError(
        `Network call ${this.state.id.value} is ${phase}. It cannot be claimed.`,
      );
    }

    return this.with({ progress: { kind: 'claimed', by: host, at: now } });
  }

  answerWith(host: CallingHost, answer: NetworkAnswer, now: Date): NetworkCall {
    const { progress } = this.state;
    const phase = this.stateAt(now);

    if (phase === 'answered') {
      throw new InvalidNetworkCallTransitionError(
        `Network call ${this.state.id.value} was already answered.`,
      );
    }

    if (phase === 'given-up') {
      throw new InvalidNetworkCallTransitionError(givenUp(this.state.id.value));
    }

    if (phase === 'lapsed') {
      throw new InvalidNetworkCallTransitionError(
        `Network call ${this.state.id.value} lapsed before it was answered.`,
      );
    }

    if (progress.kind !== 'claimed') {
      throw new InvalidNetworkCallTransitionError(
        `Network call ${this.state.id.value} is not claimed by a host yet.`,
      );
    }

    if (!progress.by.equals(host)) {
      throw new NotThisHostsCallError(this.state.id.value);
    }

    return this.with({
      request: this.state.request.spent(),
      progress: {
        kind: 'answered',
        by: progress.by,
        claimedAt: progress.at,
        at: now,
        answer,
      },
    });
  }

  lapsed(now: Date): NetworkCall {
    if (this.settled) {
      return this;
    }

    if (!this.lapsedAt(now)) {
      throw new InvalidNetworkCallTransitionError(
        `Network call ${this.state.id.value} cannot lapse before its time is up.`,
      );
    }

    return this.with({
      request: this.state.request.spent(),
      progress: { kind: 'lapsed', at: now },
    });
  }

  givenUp(now: Date): NetworkCall {
    if (this.settled) {
      return this;
    }

    return this.with({
      request: this.state.request.spent(),
      progress: { kind: 'given-up', at: now },
    });
  }

  private lapsedAt(now: Date): boolean {
    return now.getTime() >= this.state.lapsesAt.getTime();
  }

  private with(part: Partial<State>): NetworkCall {
    const next = new NetworkCall({ ...this.state, ...part }, this.isDiscarded);

    next.inheritEvents(this);

    return next;
  }
}
