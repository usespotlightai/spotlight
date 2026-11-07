import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Dispatch } from '@work/domain/aggregates/dispatch.aggregate';
import { InvalidDispatchTransitionError } from '@work/domain/exceptions/invalid-dispatch-transition.error';
import { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import {
  DispatchEnding,
  type DispatchOutcome,
} from '@work/domain/value-objects/dispatch-ending.vo';
import { DispatchOrder } from '@work/domain/value-objects/dispatch-order.vo';
import type { DispatchSubject } from '@work/domain/value-objects/dispatch-subject.vo';
import { StationConfig } from '@work/domain/value-objects/station-config.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-07T10:00:00.000Z');
const LATER = new Date('2026-11-07T10:05:00.000Z');
const RUN = RunId.of('run_1');
const STATION = StationId.of('station_1');

const CONFIG = StationConfig.rehydrate(
  {
    prompt: null,
    harness: 'dev',
    model: null,
    effort: null,
    profile: null,
    image: null,
    repositories: [],
    skills: [],
    tools: [],
    decisions: false,
    memories: false,
  },
  'f'.repeat(64),
);

const TASK: DispatchSubject = {
  kind: 'task',
  taskId: TaskId.of('task_1'),
  revision: TaskRevision.of(2),
  stationId: STATION,
};

const CHAT: DispatchSubject = { kind: 'chat', chatId: ChatId.of('chat_1') };

const TRIAL: DispatchSubject = {
  kind: 'trial',
  basedOn: RunId.of('run_0'),
  taskId: TaskId.of('task_1'),
  stationId: STATION,
  asOf: NOW,
  repositories: [{ path: 'api', repository: 'acme/api' }],
  followUp: null,
};

const MEMORIES = BriefedMemories.of({
  briefed: [{ id: 'memory_1', handle: 'M-1' }],
  omitted: [],
});

const ordering = (subject: DispatchSubject = TASK) => ({
  id: RUN,
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  subject,
  configuredAs: subject.kind === 'chat' ? null : CONFIG,
  now: NOW,
});

const ordered = (
  subject: DispatchSubject = TASK,
  briefedMemories = BriefedMemories.none(),
) =>
  Dispatch.ordered({
    ...ordering(subject),
    briefedMemories,
    order: DispatchOrder.of({ runId: RUN.value }),
  });

const ending = (outcome: DispatchOutcome, failure: string | null = null) =>
  DispatchEnding.of({ endedAt: LATER, outcome, failure, stopped: false });

const kinds = (dispatch: Dispatch) =>
  dispatch.pullEvents().map((each) => each.kind);

describe('Dispatch', () => {
  it('asks for its run to be enqueued once a task or chat orders it', () => {
    expect(kinds(ordered())).toEqual(['dispatch.ordered']);
    expect(kinds(ordered(CHAT))).toEqual(['dispatch.ordered']);
  });

  it('is refused at once when there is no order for its station', () => {
    const refused = Dispatch.unorderable(ordering());

    expect(refused.refusedBecause).toBe('no-order');
    expect(kinds(refused)).toEqual(['dispatch.refused']);
  });

  it('records a trial without asking anyone to enqueue it', () => {
    const trial = Dispatch.trialOrdered(ordering(TRIAL));

    expect(trial.order).toBeNull();
    expect(kinds(trial)).toEqual([]);
    expect(() => Dispatch.trialOrdered(ordering(TASK))).toThrow(
      InvalidDispatchTransitionError,
    );
    expect(() =>
      Dispatch.ordered({
        ...ordering(TRIAL),
        order: DispatchOrder.of({}),
      }),
    ).toThrow(InvalidDispatchTransitionError);
  });

  it('records a station config only for a run at a station, and always for a trial', () => {
    expect(() =>
      Dispatch.ordered({
        ...ordering(CHAT),
        configuredAs: CONFIG,
        order: DispatchOrder.of({}),
      }),
    ).toThrow(InvalidDispatchTransitionError);
    expect(() =>
      Dispatch.trialOrdered({ ...ordering(TRIAL), configuredAs: null }),
    ).toThrow(InvalidDispatchTransitionError);
  });

  it('says which memories it was briefed with once its run exists, and keeps no order after that', () => {
    const enqueued = ordered(TASK, MEMORIES);
    enqueued.pullEvents();

    const marked = enqueued.enqueuedAsRun();

    expect(marked.enqueued).toBe(true);
    expect(marked.order).toBeNull();
    expect(kinds(marked)).toEqual(['dispatch.briefed']);
    expect(kinds(ordered().enqueuedAsRun())).toEqual(['dispatch.ordered']);
    expect(marked.enqueuedAsRun()).toBe(marked);
  });

  it('is refused only before its run exists, and never enqueued once refused', () => {
    const withdrawn = ordered().refusedFor('withdrawn');

    expect(withdrawn.refusedBecause).toBe('withdrawn');
    expect(withdrawn.refusedFor('order-refused')).toBe(withdrawn);
    expect(() => withdrawn.enqueuedAsRun()).toThrow(
      InvalidDispatchTransitionError,
    );
    expect(() => ordered().enqueuedAsRun().refusedFor('withdrawn')).toThrow(
      InvalidDispatchTransitionError,
    );
  });

  it('ends once, whether or not its enqueueing was marked first', () => {
    const ended = ordered().ended(ending('completed'));
    ended.pullEvents();

    expect(ended.ending?.outcome).toBe('completed');
    expect(ended.ended(ending('failed', 'exited'))).toBe(ended);
    expect(ended.enqueuedAsRun().enqueued).toBe(true);
    expect(kinds(ordered(CHAT).ended(ending('completed')))).toEqual([
      'dispatch.ordered',
      'dispatch.ended',
    ]);
  });

  it('keeps the end of a trial to itself', () => {
    expect(
      kinds(Dispatch.trialOrdered(ordering(TRIAL)).ended(ending('completed'))),
    ).toEqual([]);
  });

  describe('superseded', () => {
    const failed = ending('failed', 'exited');

    it('is superseded when its task let go of it and it then failed', () => {
      const superseded = ordered().detached(NOW).ended(failed);

      expect(superseded.superseded).toBe(true);
      expect(kinds(superseded)).toEqual([
        'dispatch.ordered',
        'dispatch.ended',
        'dispatch.superseded',
      ]);
    });

    it('is superseded the same when it failed before its task let go of it', () => {
      const ended = ordered().ended(failed);
      ended.pullEvents();
      const superseded = ended.detached(LATER);

      expect(superseded.superseded).toBe(true);
      expect(kinds(superseded)).toEqual(['dispatch.superseded']);
    });

    it('is not superseded when it failed while its task still held it', () => {
      expect(ordered().ended(failed).superseded).toBe(false);
    });

    it('is not superseded when it succeeded, was cancelled or was refused', () => {
      expect(
        ordered().detached(NOW).ended(ending('completed')).superseded,
      ).toBe(false);
      expect(
        ordered().detached(NOW).ended(ending('cancelled')).superseded,
      ).toBe(false);
      expect(
        ordered().detached(NOW).ended(ending('failed', 'cancelled')).superseded,
      ).toBe(false);
      expect(
        ordered().refusedFor('withdrawn').detached(NOW).ended(failed)
          .superseded,
      ).toBe(false);
    });

    it('is never superseded for a chat or a trial', () => {
      expect(ordered(CHAT).detached(NOW).ended(failed).superseded).toBe(false);
      expect(
        Dispatch.trialOrdered(ordering(TRIAL)).detached(NOW).ended(failed)
          .superseded,
      ).toBe(false);
    });
  });

  it('refuses stored state that breaks its rules', () => {
    const stored = {
      id: RUN,
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: null,
      subject: TASK,
      order: null,
      briefedTask: null,
      briefing: null,
      briefedMemories: BriefedMemories.none(),
      configuredAs: null,
      orderedAt: NOW,
      enqueued: true,
      refused: null,
      detachedAt: null,
      ending: ending('failed', 'exited'),
      superseded: false,
      version: 1,
    };

    expect(Dispatch.rehydrate(stored).version).toBe(1);
    expect(() => Dispatch.rehydrate({ ...stored, superseded: true })).toThrow(
      InconsistentStateError,
    );
    expect(() =>
      Dispatch.rehydrate({ ...stored, enqueued: false, ending: null }),
    ).toThrow(InconsistentStateError);
    expect(() =>
      Dispatch.rehydrate({ ...stored, refused: 'withdrawn' }),
    ).toThrow(InconsistentStateError);
  });
});
