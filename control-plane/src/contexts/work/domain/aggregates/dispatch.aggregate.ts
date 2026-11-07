import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { DispatchBriefed } from '@work/domain/events/dispatch-briefed.event';
import { DispatchEnded } from '@work/domain/events/dispatch-ended.event';
import { DispatchOrdered } from '@work/domain/events/dispatch-ordered.event';
import { DispatchRefused } from '@work/domain/events/dispatch-refused.event';
import { DispatchSuperseded } from '@work/domain/events/dispatch-superseded.event';
import { InvalidDispatchTransitionError } from '@work/domain/exceptions/invalid-dispatch-transition.error';
import { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import type { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import type { DispatchEnding } from '@work/domain/value-objects/dispatch-ending.vo';
import type { DispatchOrder } from '@work/domain/value-objects/dispatch-order.vo';
import type { DispatchRefusal } from '@work/domain/value-objects/dispatch-refusal';
import {
  type DispatchSubject,
  stationOfDispatch,
  taskOfDispatch,
} from '@work/domain/value-objects/dispatch-subject';
import type { StationConfig } from '@work/domain/value-objects/station-config.vo';

interface DispatchState {
  readonly id: RunId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId | null;
  readonly subject: DispatchSubject;
  readonly order: DispatchOrder | null;
  readonly briefedTask: BriefedTask | null;
  readonly briefing: string | null;
  readonly briefedMemories: BriefedMemories;
  readonly configuredAs: StationConfig | null;
  readonly orderedAt: Date;
  readonly enqueued: boolean;
  readonly refused: DispatchRefusal | null;
  readonly detachedAt: Date | null;
  readonly ending: DispatchEnding | null;
  readonly superseded: boolean;
  readonly version: number;
}

type Ordering = Pick<
  DispatchState,
  'id' | 'workspaceId' | 'teamId' | 'subject' | 'configuredAs'
> & {
  readonly briefedTask?: BriefedTask | null;
  readonly briefing?: string | null;
  readonly briefedMemories?: BriefedMemories;
  readonly now: Date;
};

const problemOf = (state: DispatchState): string | null => {
  const station = stationOfDispatch(state.subject);

  if (state.configuredAs && !station) {
    return 'records a station config but works at no station';
  }

  if (state.subject.kind === 'trial' && !state.configuredAs) {
    return 'tries a station without the station config it tries';
  }

  if (state.briefedTask && !station?.equals(state.briefedTask.stationId)) {
    return 'records a task briefed at another station';
  }

  if (state.superseded && state.subject.kind !== 'task') {
    return 'is superseded though no task holds it';
  }

  if (state.superseded && !(state.detachedAt && state.ending?.failed)) {
    return 'is superseded though its task held it or it did not fail';
  }

  if (state.order && !state.order.fits(state.subject.kind, state.id)) {
    return 'carries the order of another run';
  }

  if (state.refused && state.enqueued) {
    return 'was both refused and enqueued';
  }

  if (
    state.subject.kind !== 'trial' &&
    !state.enqueued &&
    !state.refused &&
    !state.order
  ) {
    return 'waits to be enqueued without an order';
  }

  return null;
};

const later = (one: Date, other: Date): Date =>
  one.getTime() >= other.getTime() ? one : other;

export class Dispatch extends EventRecorder {
  private constructor(private readonly state: DispatchState) {
    super();
  }

  static ordered(
    input: Ordering & { readonly order: DispatchOrder },
  ): Dispatch {
    const dispatch = Dispatch.created(Dispatch.workedBy(input), input.order);

    dispatch.record(new DispatchOrdered(input.id, input.workspaceId));

    return dispatch;
  }

  static unorderable(input: Ordering): Dispatch {
    const refused = Dispatch.created(
      Dispatch.workedBy(input),
      null,
      'no-order',
    );

    refused.recordRefusal('no-order');

    return refused;
  }

  static trialOrdered(
    input: Ordering & { readonly order: DispatchOrder },
  ): Dispatch {
    if (input.subject.kind !== 'trial') {
      throw new InvalidDispatchTransitionError(
        `Run ${input.id.value} works a task or a chat. Order it with ordered.`,
      );
    }

    return Dispatch.created(input, input.order);
  }

  private static workedBy(input: Ordering): Ordering {
    if (input.subject.kind === 'trial') {
      throw new InvalidDispatchTransitionError(
        `Run ${input.id.value} is a trial. Order it with trialOrdered.`,
      );
    }

    return input;
  }

  private static created(
    input: Ordering,
    order: DispatchOrder | null,
    refused: DispatchRefusal | null = null,
  ): Dispatch {
    const state: DispatchState = {
      id: input.id,
      workspaceId: input.workspaceId,
      teamId: input.teamId,
      subject: input.subject,
      order,
      briefedTask: input.briefedTask ?? null,
      briefing: input.briefing ?? null,
      briefedMemories: input.briefedMemories ?? BriefedMemories.none(),
      configuredAs: input.configuredAs,
      orderedAt: input.now,
      enqueued: false,
      refused,
      detachedAt: null,
      ending: null,
      superseded: false,
      version: 0,
    };
    const problem = problemOf(state);

    if (problem) {
      throw new InvalidDispatchTransitionError(
        `Run ${input.id.value} ${problem}.`,
      );
    }

    return new Dispatch(state);
  }

  static rehydrate(state: DispatchState): Dispatch {
    const problem = problemOf(state);

    if (problem) {
      throw new InconsistentStateError('dispatch', problem);
    }

    if (state.version < 0) {
      throw new InconsistentStateError('dispatch', 'has a negative version');
    }

    return new Dispatch(state);
  }

  get id(): RunId {
    return this.state.id;
  }

  get workspaceId(): WorkspaceId {
    return this.state.workspaceId;
  }

  get teamId(): TeamId | null {
    return this.state.teamId;
  }

  get subject(): DispatchSubject {
    return this.state.subject;
  }

  get order(): DispatchOrder | null {
    return this.state.order;
  }

  get briefedTask(): BriefedTask | null {
    return this.state.briefedTask;
  }

  get briefing(): string | null {
    return this.state.briefing;
  }

  get briefedMemories(): BriefedMemories {
    return this.state.briefedMemories;
  }

  get configuredAs(): StationConfig | null {
    return this.state.configuredAs;
  }

  get orderedAt(): Date {
    return this.state.orderedAt;
  }

  get enqueued(): boolean {
    return this.state.enqueued;
  }

  get refusedBecause(): DispatchRefusal | null {
    return this.state.refused;
  }

  get detachedAt(): Date | null {
    return this.state.detachedAt;
  }

  get ending(): DispatchEnding | null {
    return this.state.ending;
  }

  get superseded(): boolean {
    return this.state.superseded;
  }

  get version(): number {
    return this.state.version;
  }

  get settled(): boolean {
    return this.state.enqueued || this.state.refused !== null;
  }

  enqueuedAsRun(): Dispatch {
    if (this.state.refused) {
      throw new InvalidDispatchTransitionError(
        `Run ${this.id.value} was refused. It cannot be enqueued.`,
      );
    }

    if (this.state.enqueued) {
      return this;
    }

    const enqueued = this.with({ enqueued: true, order: null });

    if (
      this.state.subject.kind !== 'trial' &&
      this.state.briefedMemories.briefed.length > 0
    ) {
      enqueued.record(
        new DispatchBriefed(
          this.id,
          this.workspaceId,
          taskOfDispatch(this.state.subject),
          this.state.briefedMemories,
        ),
      );
    }

    return enqueued;
  }

  refusedFor(because: DispatchRefusal): Dispatch {
    if (this.state.refused) {
      return this;
    }

    if (this.state.enqueued || this.state.ending) {
      throw new InvalidDispatchTransitionError(
        `Run ${this.id.value} is already ${this.state.ending ? 'ended' : 'enqueued'}. It cannot be refused.`,
      );
    }

    const refused = this.with({ refused: because, order: null });

    refused.recordRefusal(because);

    return refused;
  }

  private recordRefusal(because: DispatchRefusal): void {
    const subject = this.state.subject;

    if (subject.kind !== 'trial') {
      this.record(
        new DispatchRefused(
          this.id,
          this.workspaceId,
          subject.kind === 'task' ? subject.taskId : null,
          subject.kind === 'chat' ? subject.chatId : null,
          because,
        ),
      );
    }
  }

  detached(at: Date): Dispatch {
    if (this.state.detachedAt) {
      return this;
    }

    return this.with({ detachedAt: at }).supersededIfDue();
  }

  ended(ending: DispatchEnding): Dispatch {
    if (this.state.ending) {
      return this;
    }

    const subject = this.state.subject;
    const ended = this.with({ ending });

    if (subject.kind !== 'trial') {
      ended.record(
        new DispatchEnded(
          this.id,
          this.workspaceId,
          taskOfDispatch(subject),
          stationOfDispatch(subject),
          ending,
        ),
      );
    }

    return ended.supersededIfDue();
  }

  private supersededIfDue(): Dispatch {
    const subject = this.state.subject;

    if (
      this.state.superseded ||
      this.state.refused ||
      subject.kind !== 'task' ||
      !this.state.detachedAt ||
      !this.state.ending?.failed
    ) {
      return this;
    }

    const superseded = this.with({ superseded: true });

    superseded.record(
      new DispatchSuperseded(
        this.id,
        this.workspaceId,
        subject.taskId,
        later(this.state.detachedAt, this.state.ending.endedAt),
      ),
    );

    return superseded;
  }

  private with(part: Partial<DispatchState>): Dispatch {
    const next = new Dispatch({ ...this.state, ...part });

    next.inheritEvents(this);

    return next;
  }
}
