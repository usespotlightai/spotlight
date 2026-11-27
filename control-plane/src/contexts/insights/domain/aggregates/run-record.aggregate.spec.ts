import { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import { RunOutcomeChanged } from '@insights/domain/events/run-outcome-changed.event';
import { RunRecordEnded } from '@insights/domain/events/run-record-ended.event';
import { InvalidOutcomeError } from '@insights/domain/exceptions/invalid-outcome.error';
import { RunTakesNoVerdictError } from '@insights/domain/exceptions/run-takes-no-verdict.error';
import type { CheckVerdict } from '@insights/domain/value-objects/check-verdict';
import { Dismissal } from '@insights/domain/value-objects/dismissal.vo';
import { PersonAction } from '@insights/domain/value-objects/person-action.vo';
import { PersonVerdict } from '@insights/domain/value-objects/person-verdict.vo';
import { RunActions } from '@insights/domain/value-objects/run-actions.vo';
import { RunChecks } from '@insights/domain/value-objects/run-checks.vo';
import {
  MemoryReference,
  RunMemories,
} from '@insights/domain/value-objects/run-memories.vo';
import { RunTools } from '@insights/domain/value-objects/run-tools.vo';
import type { RunUsage } from '@insights/domain/value-objects/run-usage.vo';
import { StationPass } from '@insights/domain/value-objects/station-pass.vo';
import {
  endedRecord,
  endOf,
  usageOf,
  WORKSPACE,
} from '@insights/runs.fake-spec';
import { instanceOf } from '@shared-kernel/domain/instance-of.fake-spec';
import { LatencyHistogram } from '@shared-kernel/domain/value-objects/latency-histogram.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const ACTOR = UserId.of('user_actor');

const RECEIVED_AT = new Date('2026-09-30T12:00:00.000Z');

const checkOf = (
  verdict: CheckVerdict,
  stackStartedAt: Date = RECEIVED_AT,
  repository: string | null = 'api',
) => ({ repository, stackStartedAt, verdict, checkedAt: RECEIVED_AT });

const RUN = RunId.of('run_1');
const EARLIER = new Date('2026-09-30T10:00:00.000Z');
const AT = new Date('2026-09-30T11:00:00.000Z');
const LATER = new Date('2026-09-30T12:00:00.000Z');

describe('RunRecord', () => {
  it('has no ending until the run ends', () => {
    const record = RunRecord.empty(RUN, WORKSPACE);

    expect(record.hasEnded).toBe(false);
    expect(record.factWith(null, null, null)).toBeNull();
  });

  it('tells once that it ended, at the station it ended at, through later changes', () => {
    const ended = RunRecord.empty(RUN, WORKSPACE)
      .recordEnd(endOf())
      .recordEnd(endOf({ stationId: 'station_2' }))
      .recordAction(PersonAction.of('accepted', AT, ACTOR));

    const events = ended.pullEvents();
    expect(events.map((each) => each.kind)).toEqual([
      'run-record.ended',
      'run-record.outcome-changed',
    ]);
    expect(events[0]).toBeInstanceOf(RunRecordEnded);
    expect(instanceOf(RunRecordEnded, events[0]).location.stationId.value).toBe(
      'station_1',
    );
    expect(ended.pullEvents()).toEqual([]);
  });

  it('records that it is enriched once for each outcome it learns after it ended, and not for one it already knew', () => {
    const record = RunRecord.empty(RUN, WORKSPACE).recordAction(
      PersonAction.of('accepted', AT, ACTOR),
    );
    expect(record.pullEvents()).toEqual([]);

    const learned = record
      .recordEnd(endOf())
      .recordAction(PersonAction.of('sent-back', LATER, ACTOR))
      .recordAction(PersonAction.of('approved', LATER, ACTOR))
      .recordAction(PersonAction.of('dismissed', LATER, ACTOR))
      .recordCheck(checkOf('skipped'))
      .recordCheck(checkOf('passed'))
      .recordCheck(checkOf('failed'))
      .recordUsage(usageOf(), RunTools.NONE)
      .recordUsage(usageOf({ amount: 2 }), RunTools.NONE);

    const events = learned.pullEvents();
    expect(events.map((each) => each.kind)).toEqual([
      'run-record.ended',
      'run-record.outcome-changed',
      'run-record.outcome-changed',
      'run-record.outcome-changed',
      'run-record.outcome-changed',
    ]);
    expect(events[1]).toBeInstanceOf(RunOutcomeChanged);
    expect(
      instanceOf(RunOutcomeChanged, events[1]).location.stationId.value,
    ).toBe('station_1');
  });

  it('keeps the first end it receives', () => {
    const ended = RunRecord.empty(RUN, WORKSPACE).recordEnd(
      endOf({ ending: 'failed' }),
    );

    expect(ended.recordEnd(endOf({ ending: 'completed' }))).toBe(ended);
    expect(ended.factWith(null, null, null)?.ending).toBe('failed');
  });

  it('ends as superseded when its task superseded it after it ended', () => {
    expect(
      endedRecord('run_1')
        .supersededByItsTask(RECEIVED_AT)
        .factWith(null, null, null)?.ending,
    ).toBe('superseded');
  });

  it('ends as superseded when told so before its end was received', () => {
    const superseded = RunRecord.empty(RUN, WORKSPACE)
      .supersededByItsTask(RECEIVED_AT)
      .recordEnd(endOf({ ending: 'completed' }));

    expect(superseded.factWith(null, null, null)?.ending).toBe('superseded');
  });

  it('is left as it is when superseded twice', () => {
    const superseded = endedRecord('run_1').supersededByItsTask(RECEIVED_AT);

    expect(superseded.supersededByItsTask(RECEIVED_AT)).toBe(superseded);
  });

  it('keeps the first verdict on the same stack', () => {
    const failed = endedRecord('run_1').recordCheck(checkOf('failed'));

    expect(failed.recordCheck(checkOf('passed'))).toBe(failed);
    expect(failed.checks).toBe('failed');
  });

  it('takes the verdict of a later handover in the same run', () => {
    const failed = endedRecord('run_1').recordCheck(checkOf('failed', EARLIER));

    expect(failed.recordCheck(checkOf('passed', LATER)).checks).toBe('passed');
  });

  it('fails when one of its repositories fails', () => {
    const checked = endedRecord('run_1')
      .recordCheck(checkOf('passed', AT, 'api'))
      .recordCheck(checkOf('failed', AT, 'web'));

    expect(checked.checks).toBe('failed');
  });

  it('records once that it asked a person', () => {
    const asked = endedRecord('run_1').recordAsked();

    expect(asked.asked).toBe(true);
    expect(asked.recordAsked()).toBe(asked);
    expect(asked.factWith(null, null, null)?.asked).toBe(true);
  });

  it('takes a real verdict over a skipped check, in either order', () => {
    const skippedFirst = endedRecord('run_1')
      .recordCheck(checkOf('skipped'))
      .recordCheck(checkOf('passed'));
    const passedFirst = endedRecord('run_1')
      .recordCheck(checkOf('passed'))
      .recordCheck(checkOf('skipped'));

    expect(skippedFirst.checks).toBe('passed');
    expect(passedFirst.checks).toBe('passed');
  });

  it('takes its verdict before its end is received', () => {
    const checked = RunRecord.empty(RUN, WORKSPACE)
      .recordCheck(checkOf('passed'))
      .recordEnd(endOf());

    expect(checked.checks).toBe('passed');
  });

  it('counts only the first deciding action a person took after it', () => {
    const acted = endedRecord('run_1').recordAction(
      PersonAction.of('sent-back', AT, ACTOR),
    );

    expect(acted.recordAction(PersonAction.of('accepted', LATER, ACTOR))).toBe(
      acted,
    );
    expect(acted.actions.decidingAction?.kind).toBe('sent-back');
    expect(acted.actions.decidingAction?.at).toEqual(AT);
  });

  it('counts the first deciding action a person took after it, in whatever order it receives what they did', () => {
    const actions = [
      PersonAction.of('approved', EARLIER, ACTOR),
      PersonAction.of('sent-back', AT, ACTOR),
      PersonAction.of('dismissed', AT, ACTOR),
      PersonAction.of('accepted', LATER, ACTOR),
    ];
    const receivedIn = (order: readonly PersonAction[]) =>
      order.reduce(
        (record, action) => record.recordAction(action),
        endedRecord('run_1'),
      );

    for (const order of [
      actions,
      [...actions].reverse(),
      [actions[3], actions[0], actions[2], actions[1]],
    ]) {
      const record = receivedIn(order);

      expect(record.actions.decidingAction?.kind).toBe('sent-back');
      expect(record.approvalAnsweredAt).toEqual(EARLIER);
      expect(record.factWith(null, null, null)?.disposition).toBe('sent-back');
    }
  });

  it('decides between actions at the same moment the same way whichever it receives first', () => {
    const closed = PersonAction.of('accepted', AT, ACTOR);
    const sentBack = PersonAction.of('sent-back', AT, ACTOR);

    expect(
      endedRecord('run_1').recordAction(closed).recordAction(sentBack).actions
        .decidingAction?.kind,
    ).toBe(
      endedRecord('run_1').recordAction(sentBack).recordAction(closed).actions
        .decidingAction?.kind,
    );
  });

  it.each([
    'accepted',
    'sent-back',
    'held-as-wrong',
    'started',
    'parked',
  ] as const)(
    'lets a person %s it after answering it, in whatever order it receives the two',
    (action) => {
      const answered = PersonAction.of('answered', AT, ACTOR);
      const decided = PersonAction.of(action, LATER, ACTOR);

      for (const order of [
        [answered, decided],
        [decided, answered],
      ]) {
        const record = order.reduce(
          (each, action) => each.recordAction(action),
          endedRecord('run_1'),
        );

        expect(record.actions.decidingAction?.kind).toBe(action);
        expect(record.actions.decidingAction?.at).toEqual(LATER);
      }
    },
  );

  it('lets the first of several deciding actions after an answer decide it, received in any order', () => {
    const actions = [
      PersonAction.of('accepted', LATER, ACTOR),
      PersonAction.of('answered', EARLIER, ACTOR),
      PersonAction.of('sent-back', AT, ACTOR),
    ];

    for (const order of [actions, [...actions].reverse()]) {
      const record = order.reduce(
        (each, action) => each.recordAction(action),
        endedRecord('run_1'),
      );

      expect(record.actions.decidingAction?.kind).toBe('sent-back');
    }
  });

  it.each(['accepted', 'started', 'parked'] as const)(
    'lets a person %s it at the moment they answer it',
    (action) => {
      const answered = PersonAction.of('answered', AT, ACTOR);
      const decided = PersonAction.of(action, AT, ACTOR);

      for (const order of [
        [answered, decided],
        [decided, answered],
      ]) {
        expect(
          order.reduce(
            (each, action) => each.recordAction(action),
            endedRecord('run_1'),
          ).actions.decidingAction?.kind,
        ).toBe(action);
      }
    },
  );

  it('lets a deciding action before an answer decide it', () => {
    const record = endedRecord('run_1')
      .recordAction(PersonAction.of('answered', LATER, ACTOR))
      .recordAction(PersonAction.of('accepted', AT, ACTOR));

    expect(record.actions.decidingAction?.kind).toBe('accepted');
    expect(record.actions.decidingAction?.at).toEqual(AT);
  });

  it('keeps the first answer while nothing decides it', () => {
    const answered = endedRecord('run_1').recordAction(
      PersonAction.of('answered', AT, ACTOR),
    );

    expect(
      answered.recordAction(PersonAction.of('answered', LATER, ACTOR)),
    ).toBe(answered);
    expect(answered.factWith(null, null, null)?.disposition).toBe('asked');
  });

  it('turned out accepted when a person accepted it after answering what it asked for review', () => {
    const accepted = endedRecord('run_1')
      .recordAction(PersonAction.of('answered', AT, ACTOR))
      .recordAction(PersonAction.of('accepted', LATER, ACTOR))
      .factWith(null, null, null);

    expect(accepted?.resolution).toBe('accepted');
    expect(accepted?.disposition).toBe('accepted');
    expect(accepted?.humanLabel?.from).toBe('accepted');
  });

  it('never lets answering an approval decide what a person did next', () => {
    const approved = endedRecord('run_1').recordAction(
      PersonAction.of('approved', AT, ACTOR),
    );

    expect(approved.actions.decidingAction).toBeNull();
    expect(approved.approvalAnsweredAt).toEqual(AT);
    expect(
      approved.recordAction(PersonAction.of('dismissed', LATER, ACTOR)),
    ).toBe(approved);
  });

  it('keeps its version until it is saved', () => {
    const record = RunRecord.rehydrate({
      runId: RUN,
      workspaceId: WORKSPACE,
      taskId: TaskId.of('task_1'),
      end: endOf(),
      supersededAt: null,
      asked: false,
      checked: RunChecks.NONE,
      actions: RunActions.NONE,
      personVerdict: null,
      approvalAnsweredAt: null,
      usage: null,
      passed: null,
      tools: null,
      dismissals: [],
      memories: RunMemories.NONE,
      version: 3,
    });

    expect(
      record
        .recordCheck(checkOf('passed'))
        .recordAction(PersonAction.of('accepted', AT, ACTOR)).version,
    ).toBe(3);
  });

  it('knows its task once it ends, or when it is received with it', () => {
    expect(RunRecord.empty(RUN, WORKSPACE).taskId).toBeNull();
    expect(
      RunRecord.empty(RUN, WORKSPACE, TaskId.of('task_2')).taskId?.value,
    ).toBe('task_2');
    expect(
      RunRecord.empty(RUN, WORKSPACE).recordEnd(endOf({ taskId: 'task_3' }))
        .taskId?.value,
    ).toBe('task_3');
  });

  it('did not run when it was cancelled before it ran, and stays cancelled once superseded', () => {
    const cancelled = endedRecord('run_1', { ending: 'cancelled' });

    expect(cancelled.ran).toBe(false);
    expect(cancelled.supersededByItsTask(RECEIVED_AT).ran).toBe(false);
    expect(
      cancelled.supersededByItsTask(RECEIVED_AT).factWith(null, null, null)
        ?.ending,
    ).toBe('cancelled');
    expect(endedRecord('run_2', { ending: 'failed' }).ran).toBe(true);
    expect(RunRecord.empty(RUN, WORKSPACE).ran).toBe(false);
  });

  it('does not end on another task than the one it was received for', () => {
    expect(() =>
      RunRecord.empty(RUN, WORKSPACE, TaskId.of('task_2')).recordEnd(
        endOf({ taskId: 'task_1' }),
      ),
    ).toThrow(InvalidOutcomeError);
  });

  it('is stored ending on the task it is recorded under', () => {
    expect(() =>
      RunRecord.rehydrate({
        runId: RUN,
        workspaceId: WORKSPACE,
        taskId: TaskId.of('task_2'),
        end: endOf({ taskId: 'task_1' }),
        supersededAt: null,
        asked: false,
        checked: RunChecks.NONE,
        actions: RunActions.NONE,
        personVerdict: null,
        approvalAnsweredAt: null,
        usage: null,
        passed: null,
        tools: null,
        dismissals: [],
        memories: RunMemories.NONE,
        version: 0,
      }),
    ).toThrow(InvalidOutcomeError);
  });

  it('keeps the first cost it receives, before or after it ended', () => {
    const recorded = RunRecord.empty(RUN, WORKSPACE).recordUsage(
      usageOf({ amount: 0.4 }),
      RunTools.NONE,
    );
    const ended = recorded.recordEnd(endOf());

    expect(ended.usage?.spend?.amount).toBe(0.4);
    expect(ended.recordUsage(usageOf({ amount: 9 }), RunTools.NONE)).toBe(
      ended,
    );
  });

  it('keeps the first station it passed its task to', () => {
    const passed = endedRecord('run_1').passTo(
      StationPass.of(StationId.of('station_2'), AT),
    );

    expect(
      passed.passTo(StationPass.of(StationId.of('station_3'), LATER)),
    ).toBe(passed);
    expect(passed.passed?.to.value).toBe('station_2');
  });

  it('keeps the tools it used with the first usage it receives', () => {
    const used = RunTools.of({
      servers: [
        {
          server: 'linear',
          calls: 1,
          failed: 0,
          latency: LatencyHistogram.timing([200]),
          lastCallFailed: false,
        },
      ],
      skillsRead: ['grafana'],
    });
    const recorded = endedRecord('run_1').recordUsage(usageOf(), used);

    expect(recorded.tools?.skillsRead.includes('grafana')).toBe(true);
    expect(recorded.recordUsage(usageOf(), RunTools.NONE)).toBe(recorded);
  });

  it('has the tools it used only once its usage is recorded, and may be read without them', () => {
    const stored = (usage: RunUsage | null, tools: RunTools | null) =>
      RunRecord.rehydrate({
        runId: RUN,
        workspaceId: WORKSPACE,
        taskId: TaskId.of('task_1'),
        end: endOf({ taskId: 'task_1' }),
        supersededAt: null,
        asked: false,
        checked: RunChecks.NONE,
        actions: RunActions.NONE,
        personVerdict: null,
        approvalAnsweredAt: null,
        usage,
        passed: null,
        tools,
        dismissals: [],
        memories: RunMemories.NONE,
        version: 0,
      });

    expect(() => stored(null, RunTools.NONE)).toThrow(InvalidOutcomeError);
    expect(stored(usageOf(), null).tools).toBeNull();
  });

  it('notes each dismissal once, however often it is received', () => {
    const dismissal = Dismissal.of({
      tool: 'mcp__linear__create_issue',
      server: 'linear',
      at: AT,
    });
    const dismissed = endedRecord('run_1').dismissed(dismissal);

    expect(dismissed.dismissed(dismissal)).toBe(dismissed);
    expect(
      dismissed.dismissed(Dismissal.of({ ...dismissal, at: LATER })).dismissals,
    ).toHaveLength(2);
    expect(
      dismissed.dismissed(Dismissal.of({ ...dismissal, server: 'jira' }))
        .dismissals,
    ).toHaveLength(2);
  });

  it('turned out sent back by what a person did next, before how it ended, and failed, not accepted, for replays when a person accepted it after it failed', () => {
    const ended = RunRecord.empty(RUN, WORKSPACE).recordEnd(
      endOf({ ending: 'failed' }),
    );

    expect(
      ended
        .recordAction(PersonAction.of('accepted', AT, ACTOR))
        .factWith(null, null, null)?.disposition,
    ).toBe('failed');
    expect(
      ended
        .recordAction(PersonAction.of('sent-back', AT, ACTOR))
        .factWith(null, null, null)?.disposition,
    ).toBe('sent-back');
  });

  it('turned out accepted when a person closed its task after approving a tool it asked for', () => {
    const accepted = RunRecord.empty(RUN, WORKSPACE)
      .recordEnd(endOf())
      .recordAction(PersonAction.of('approved', AT, ACTOR))
      .recordAction(PersonAction.of('accepted', LATER, ACTOR));

    expect(accepted.actions.decidingAction?.kind).toBe('accepted');
    expect(accepted.factWith(null, null, null)?.disposition).toBe('accepted');
  });

  it('turned out sent back when a person sent it back after approving a tool it asked for', () => {
    const sentBack = RunRecord.empty(RUN, WORKSPACE)
      .recordEnd(endOf())
      .recordAction(PersonAction.of('approved', AT, ACTOR))
      .recordAction(PersonAction.of('sent-back', LATER, ACTOR));

    expect(sentBack.actions.decidingAction?.kind).toBe('sent-back');
    expect(sentBack.factWith(null, null, null)?.disposition).toBe('sent-back');
  });

  it('turned out accepted when a person closed its task after dismissing a tool it asked for', () => {
    const accepted = RunRecord.empty(RUN, WORKSPACE)
      .recordEnd(endOf())
      .recordAction(PersonAction.of('dismissed', AT, ACTOR))
      .recordAction(PersonAction.of('accepted', LATER, ACTOR));

    expect(accepted.actions.decidingAction?.kind).toBe('accepted');
    expect(accepted.factWith(null, null, null)?.disposition).toBe('accepted');
  });

  it('turned out failed when it failed and nobody accepted or sent it back', () => {
    expect(
      RunRecord.empty(RUN, WORKSPACE)
        .recordEnd(endOf({ ending: 'failed' }))
        .recordAction(PersonAction.of('answered', AT, ACTOR))
        .factWith(null, null, null)?.disposition,
    ).toBe('failed');
  });

  it('turned out asking when a person answered what it asked', () => {
    expect(
      RunRecord.empty(RUN, WORKSPACE)
        .recordEnd(endOf())
        .recordAction(PersonAction.of('answered', AT, ACTOR))
        .factWith(null, null, null)?.disposition,
    ).toBe('asked');
  });

  it('turned out asking, neither accepted nor sent back, when a person only answered a tool or permission approval', () => {
    const ended = RunRecord.empty(RUN, WORKSPACE).recordEnd(endOf());

    for (const action of ['approved', 'dismissed'] as const) {
      const answered = ended.recordAction(PersonAction.of(action, AT, ACTOR));

      expect(answered.factWith(null, null, null)?.disposition).toBe('asked');
      expect(answered.actions.decidingAction).toBeNull();
    }
  });

  it('turned out failed when it failed after a person answered a tool approval it asked for', () => {
    expect(
      RunRecord.empty(RUN, WORKSPACE)
        .recordEnd(endOf({ ending: 'failed' }))
        .recordAction(PersonAction.of('approved', AT, ACTOR))
        .factWith(null, null, null)?.disposition,
    ).toBe('failed');
  });

  it('turned out asking when a person parked its task after answering a tool approval it asked for', () => {
    expect(
      RunRecord.empty(RUN, WORKSPACE)
        .recordEnd(endOf())
        .recordAction(PersonAction.of('approved', AT, ACTOR))
        .recordAction(PersonAction.of('parked', LATER, ACTOR))
        .factWith(null, null, null)?.disposition,
    ).toBe('asked');
  });

  it('turned out asking when it ended waiting on a person nobody has answered yet', () => {
    expect(
      RunRecord.empty(RUN, WORKSPACE)
        .recordEnd(endOf())
        .recordAsked()
        .factWith(null, null, null)?.disposition,
    ).toBe('asked');
  });

  it('turned out some other way when nothing told how', () => {
    expect(
      RunRecord.empty(RUN, WORKSPACE)
        .recordEnd(endOf())
        .factWith(null, null, null)?.disposition,
    ).toBe('other');
    expect(
      RunRecord.empty(RUN, WORKSPACE)
        .recordEnd(endOf())
        .recordAction(PersonAction.of('parked', AT, ACTOR))
        .factWith(null, null, null)?.disposition,
    ).toBe('other');
  });

  it('keeps the memories a run used, received before or after it ended, and says so only once it ended', () => {
    const briefed = RunRecord.empty(RUN, WORKSPACE).recordMemories('briefed', [
      MemoryReference.of('mem_1'),
    ]);
    const ended = briefed
      .recordEnd(endOf())
      .recordMemories('recalled', [MemoryReference.of('mem_2')]);

    expect(ended.memories.briefed).toEqual(['mem_1']);
    expect(ended.memories.recalled).toEqual(['mem_2']);
    expect(
      ended.recordMemories('recalled', [MemoryReference.of('mem_2')]),
    ).toBe(ended);
    expect(
      briefed
        .recordMemories('briefed', [MemoryReference.of('mem_3')])
        .pullEvents(),
    ).toEqual([]);
    expect(
      endedRecord('run_2')
        .recordMemories('recalled', [MemoryReference.of('mem_2')])
        .pullEvents()
        .map((each) => each.kind),
    ).toEqual(['run-record.ended', 'run-record.memories-recorded']);
  });

  it('says its outcome changed when it is superseded or passed on after it ended', () => {
    const ended = endedRecord('run_1');
    ended.pullEvents();

    expect(
      ended
        .supersededByItsTask(LATER)
        .passTo(StationPass.of(StationId.of('station_2'), LATER))
        .pullEvents()
        .map((each) => each.kind),
    ).toEqual(['run-record.outcome-changed', 'run-record.outcome-changed']);
  });

  it('says it noted a dismissal only once it ended', () => {
    const dismissal = Dismissal.of({ tool: 'merge', server: null, at: AT });

    expect(
      RunRecord.empty(RUN, WORKSPACE).dismissed(dismissal).pullEvents(),
    ).toEqual([]);

    const ended = endedRecord('run_1');
    ended.pullEvents();

    expect(
      ended
        .dismissed(dismissal)
        .pullEvents()
        .map((each) => each.kind),
    ).toEqual(['run-record.dismissal-recorded']);
  });

  it('says it was erased', () => {
    expect(
      endedRecord('run_1')
        .delete()
        .pullEvents()
        .map((each) => each.kind),
    ).toEqual(['run-record.ended', 'run-record.erased']);
  });

  it('credits an action without a run to the newest run of the task at the station that ran and ended by then', () => {
    const records = [
      endedRecord('run_old', { endedAt: EARLIER }),
      endedRecord('run_newest', { endedAt: AT }),
      endedRecord('run_cancelled', {
        endedAt: AT,
        ending: 'cancelled',
      }),
      endedRecord('run_after', { endedAt: LATER }),
      RunRecord.empty(RunId.of('run_open'), WORKSPACE),
    ];

    expect(RunRecord.creditedWithActionAt(records, AT)?.runId.value).toBe(
      'run_newest',
    );
    expect(
      RunRecord.creditedWithActionAt(records, new Date(EARLIER.getTime() - 1)),
    ).toBeNull();
  });
});

describe('RunRecord verdict of a person', () => {
  const wrong = (reason: string | null = 'It planned the change.') =>
    PersonVerdict.of({ right: false, reason, by: ACTOR, at: LATER });

  it('takes a person’s verdict on a finished run, even after its task moved on, and tells that its outcome changed', () => {
    const moved = endedRecord('run_1').recordAction(
      PersonAction.of('started', AT, ACTOR),
    );
    moved.pullEvents();

    const marked = moved.recordVerdict(wrong());

    expect(marked.personVerdict).toEqual(wrong());
    expect(marked.pullEvents().map((each) => each.kind)).toEqual([
      'run-record.outcome-changed',
    ]);
  });

  it('refuses a verdict on a run that has not ended, or that ended before it ran', () => {
    expect(() =>
      RunRecord.empty(RUN, WORKSPACE).recordVerdict(wrong()),
    ).toThrow(RunTakesNoVerdictError);
    expect(() =>
      endedRecord('run_1', { ending: 'cancelled' }).recordVerdict(wrong()),
    ).toThrow(RunTakesNoVerdictError);
  });

  it('changes and clears the verdict, and stays as it is where nothing changes', () => {
    const marked = endedRecord('run_1').recordVerdict(wrong());
    marked.pullEvents();

    expect(marked.recordVerdict(wrong())).toBe(marked);

    const right = marked.recordVerdict(
      PersonVerdict.of({ right: true, reason: null, by: ACTOR, at: LATER }),
    );
    expect(right.personVerdict?.right).toBe(true);

    const cleared = right.clearVerdict();
    expect(cleared.personVerdict).toBeNull();
    expect(cleared.clearVerdict()).toBe(cleared);
    expect(cleared.pullEvents().map((each) => each.kind)).toEqual([
      'run-record.outcome-changed',
      'run-record.outcome-changed',
    ]);
  });

  it('keeps the verdict through later changes, and gives it to its fact', () => {
    const marked = endedRecord('run_1')
      .recordVerdict(wrong())
      .recordAction(PersonAction.of('accepted', LATER, ACTOR));

    expect(marked.factWith(null, null, null)?.personVerdict).toEqual(wrong());
  });

  it('is not stored with a verdict before it ran to an end', () => {
    expect(() =>
      RunRecord.rehydrate({
        ...RunRecord.empty(RUN, WORKSPACE),
        personVerdict: wrong(),
      }),
    ).toThrow(InvalidOutcomeError);
  });
});
