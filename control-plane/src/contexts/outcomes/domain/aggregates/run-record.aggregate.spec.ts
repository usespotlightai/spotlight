import { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import { RunRecordEnded } from '@outcomes/domain/events/run-record-ended.event';
import { RunRecordEnriched } from '@outcomes/domain/events/run-record-enriched.event';
import { InvalidOutcomeError } from '@outcomes/domain/exceptions/invalid-outcome.error';
import {
  costOf,
  endedRecord,
  endOf,
  WORKSPACE,
} from '@outcomes/domain/outcomes.fake-spec';
import { NextAct } from '@outcomes/domain/value-objects/next-act.vo';
import { Refusal } from '@outcomes/domain/value-objects/refusal.vo';
import type { RunCost } from '@outcomes/domain/value-objects/run-cost.vo';
import { RunMemories } from '@outcomes/domain/value-objects/run-memories.vo';
import { RunTools } from '@outcomes/domain/value-objects/run-tools.vo';
import { StationPass } from '@outcomes/domain/value-objects/station-pass.vo';
import { LatencyHistogram } from '@shared-kernel/domain/value-objects/latency-histogram.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const RECEIVED_AT = new Date('2026-09-30T12:00:00.000Z');

const RUN = RunId.of('run_1');
const EARLIER = new Date('2026-09-30T10:00:00.000Z');
const AT = new Date('2026-09-30T11:00:00.000Z');
const LATER = new Date('2026-09-30T12:00:00.000Z');

describe('RunRecord', () => {
  it('has no ending until the run ends', () => {
    const record = RunRecord.empty(RUN, WORKSPACE);

    expect(record.hasEnded).toBe(false);
    expect(record.ending).toBeNull();
  });

  it('tells once that it ended, at the station it ended at, through later changes', () => {
    const ended = RunRecord.empty(RUN, WORKSPACE)
      .recordEnd(endOf())
      .recordEnd(endOf({ stationId: 'station_2' }))
      .recordAction(NextAct.of('closed', AT));

    const events = ended.pullEvents();
    expect(events.map((each) => each.kind)).toEqual([
      'run-record.ended',
      'run-record.enriched',
    ]);
    expect(events[0]).toBeInstanceOf(RunRecordEnded);
    expect((events[0] as RunRecordEnded).place.stationId).toBe('station_1');
    expect(ended.pullEvents()).toEqual([]);
  });

  it('records that it is enriched once for each outcome it learns after it ended, and not for one it already knew', () => {
    const record = RunRecord.empty(RUN, WORKSPACE).recordAction(
      NextAct.of('closed', AT),
    );
    expect(record.pullEvents()).toEqual([]);

    const learned = record
      .recordEnd(endOf())
      .recordAction(NextAct.of('sent-back', LATER))
      .recordAction(NextAct.of('approved', LATER))
      .recordAction(NextAct.of('refused', LATER))
      .recordCheck('skipped', RECEIVED_AT)
      .recordCheck('passed', RECEIVED_AT)
      .recordCheck('failed', RECEIVED_AT)
      .recordDigest(costOf(), RunTools.NONE)
      .recordDigest(costOf({ amount: 2 }), RunTools.NONE);

    const events = learned.pullEvents();
    expect(events.map((each) => each.kind)).toEqual([
      'run-record.ended',
      'run-record.enriched',
      'run-record.enriched',
      'run-record.enriched',
      'run-record.enriched',
    ]);
    expect(events[1]).toBeInstanceOf(RunRecordEnriched);
    expect((events[1] as RunRecordEnriched).place.stationId).toBe('station_1');
  });

  it('keeps the first end it receives', () => {
    const ended = RunRecord.empty(RUN, WORKSPACE).recordEnd(
      endOf({ ending: 'failed' }),
    );

    expect(ended.recordEnd(endOf({ ending: 'completed' }))).toBe(ended);
    expect(ended.ending).toBe('failed');
  });

  it('ends as superseded when its task superseded it after it ended', () => {
    expect(endedRecord('run_1').supersededByItsTask(RECEIVED_AT).ending).toBe(
      'superseded',
    );
  });

  it('ends as superseded when told so before its end was received', () => {
    const superseded = RunRecord.empty(RUN, WORKSPACE)
      .supersededByItsTask(RECEIVED_AT)
      .recordEnd(endOf({ ending: 'completed' }));

    expect(superseded.ending).toBe('superseded');
  });

  it('is left as it is when superseded twice', () => {
    const superseded = endedRecord('run_1').supersededByItsTask(RECEIVED_AT);

    expect(superseded.supersededByItsTask(RECEIVED_AT)).toBe(superseded);
  });

  it('keeps the first verdict on its change', () => {
    const failed = endedRecord('run_1').recordCheck('failed', RECEIVED_AT);

    expect(failed.recordCheck('passed', RECEIVED_AT)).toBe(failed);
    expect(failed.checks).toBe('failed');
  });

  it('takes a real verdict over a skipped check, in either order', () => {
    const skippedFirst = endedRecord('run_1')
      .recordCheck('skipped', RECEIVED_AT)
      .recordCheck('passed', RECEIVED_AT);
    const passedFirst = endedRecord('run_1')
      .recordCheck('passed', RECEIVED_AT)
      .recordCheck('skipped', RECEIVED_AT);

    expect(skippedFirst.checks).toBe('passed');
    expect(passedFirst.checks).toBe('passed');
  });

  it('takes its verdict before its end is received', () => {
    const checked = RunRecord.empty(RUN, WORKSPACE)
      .recordCheck('passed', RECEIVED_AT)
      .recordEnd(endOf());

    expect(checked.checks).toBe('passed');
  });

  it('counts only the first thing a person did after it', () => {
    const acted = endedRecord('run_1').recordAction(
      NextAct.of('sent-back', AT),
    );

    expect(acted.recordAction(NextAct.of('closed', LATER))).toBe(acted);
    expect(acted.next?.act).toBe('sent-back');
    expect(acted.next?.at).toEqual(AT);
  });

  it('counts the first thing a person did after it, in whatever order it receives what they did', () => {
    const acts = [
      NextAct.of('approved', EARLIER),
      NextAct.of('sent-back', AT),
      NextAct.of('refused', AT),
      NextAct.of('closed', LATER),
    ];
    const receivedIn = (order: readonly NextAct[]) =>
      order.reduce(
        (record, act) => record.recordAction(act),
        endedRecord('run_1'),
      );

    for (const order of [
      acts,
      [...acts].reverse(),
      [acts[3], acts[0], acts[2], acts[1]],
    ]) {
      const record = receivedIn(order);

      expect(record.next?.act).toBe('sent-back');
      expect(record.approvalAnsweredAt).toEqual(EARLIER);
      expect(record.turnout).toBe('sent-back');
    }
  });

  it('decides between acts at the same moment the same way whichever it receives first', () => {
    const closed = NextAct.of('closed', AT);
    const sentBack = NextAct.of('sent-back', AT);

    expect(
      endedRecord('run_1').recordAction(closed).recordAction(sentBack).next
        ?.act,
    ).toBe(
      endedRecord('run_1').recordAction(sentBack).recordAction(closed).next
        ?.act,
    );
  });

  it('never lets answering an approval decide what a person did next', () => {
    const approved = endedRecord('run_1').recordAction(
      NextAct.of('approved', AT),
    );

    expect(approved.next).toBeNull();
    expect(approved.approvalAnsweredAt).toEqual(AT);
    expect(approved.recordAction(NextAct.of('refused', LATER))).toBe(approved);
  });

  it('is not read back as decided by an approval answer', () => {
    expect(() =>
      RunRecord.rehydrate({
        runId: RUN,
        workspaceId: WORKSPACE,
        taskId: TaskId.of('task_1'),
        end: null,
        supersededAt: null,
        checks: null,
        checkedAt: null,
        next: NextAct.of('approved', AT),
        approvalAnsweredAt: null,
        cost: null,
        passed: null,
        tools: null,
        refusals: [],
        memories: RunMemories.NONE,
        version: 0,
      }),
    ).toThrow(InvalidOutcomeError);
  });

  it('leaves out an approval answered after the moment it is read as of', () => {
    const approved = endedRecord('run_1').recordAction(
      NextAct.of('approved', LATER),
    );

    expect(approved.asOf(AT).approvalAnsweredAt).toBeNull();
    expect(approved.asOf(LATER).approvalAnsweredAt).toEqual(LATER);
  });

  it('keeps its version until it is saved', () => {
    const record = RunRecord.rehydrate({
      runId: RUN,
      workspaceId: WORKSPACE,
      taskId: TaskId.of('task_1'),
      end: endOf(),
      supersededAt: null,
      checks: null,
      checkedAt: null,
      next: null,
      approvalAnsweredAt: null,
      cost: null,
      passed: null,
      tools: null,
      refusals: [],
      memories: RunMemories.NONE,
      version: 3,
    });

    expect(
      record
        .recordCheck('passed', RECEIVED_AT)
        .recordAction(NextAct.of('closed', AT)).version,
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
    expect(cancelled.supersededByItsTask(RECEIVED_AT).ending).toBe('cancelled');
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
        checks: null,
        checkedAt: null,
        next: null,
        approvalAnsweredAt: null,
        cost: null,
        passed: null,
        tools: null,
        refusals: [],
        memories: RunMemories.NONE,
        version: 0,
      }),
    ).toThrow(InvalidOutcomeError);
  });

  it('keeps the first cost it receives, before or after it ended', () => {
    const digested = RunRecord.empty(RUN, WORKSPACE).recordDigest(
      costOf({ amount: 0.4 }),
      RunTools.NONE,
    );
    const ended = digested.recordEnd(endOf());

    expect(ended.cost?.spend?.amount).toBe(0.4);
    expect(ended.recordDigest(costOf({ amount: 9 }), RunTools.NONE)).toBe(
      ended,
    );
  });

  it('keeps the first station it passed its task to', () => {
    const passed = endedRecord('run_1').passTo(StationPass.of('station_2', AT));

    expect(passed.passTo(StationPass.of('station_3', LATER))).toBe(passed);
    expect(passed.passed?.to).toBe('station_2');
  });

  it('keeps the tools it used with the first digest it receives', () => {
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
    const digested = endedRecord('run_1').recordDigest(costOf(), used);

    expect(digested.tools?.read('grafana')).toBe(true);
    expect(digested.recordDigest(costOf(), RunTools.NONE)).toBe(digested);
  });

  it('has the tools it used only once digested, and may be read without them', () => {
    const stored = (cost: RunCost | null, tools: RunTools | null) =>
      RunRecord.rehydrate({
        runId: RUN,
        workspaceId: WORKSPACE,
        taskId: TaskId.of('task_1'),
        end: endOf({ taskId: 'task_1' }),
        supersededAt: null,
        checks: null,
        checkedAt: null,
        next: null,
        approvalAnsweredAt: null,
        cost,
        passed: null,
        tools,
        refusals: [],
        memories: RunMemories.NONE,
        version: 0,
      });

    expect(() => stored(null, RunTools.NONE)).toThrow(InvalidOutcomeError);
    expect(stored(costOf(), null).tools).toBeNull();
  });

  it('notes each refusal once, however often it is received', () => {
    const refusal = Refusal.of({
      tool: 'mcp__linear__create_issue',
      server: 'linear',
      at: AT,
    });
    const refused = endedRecord('run_1').refused(refusal);

    expect(refused.refused(refusal)).toBe(refused);
    expect(
      refused.refused(Refusal.of({ ...refusal, at: LATER })).refusals,
    ).toHaveLength(2);
    expect(
      refused.refused(Refusal.of({ ...refusal, server: 'jira' })).refusals,
    ).toHaveLength(2);
  });

  it('turned out accepted or sent back by what a person did next, before how it ended', () => {
    const ended = RunRecord.empty(RUN, WORKSPACE).recordEnd(
      endOf({ ending: 'failed' }),
    );

    expect(ended.recordAction(NextAct.of('closed', AT)).turnout).toBe(
      'accepted',
    );
    expect(ended.recordAction(NextAct.of('sent-back', AT)).turnout).toBe(
      'sent-back',
    );
  });

  it('turned out accepted when a person closed its task after approving a tool it asked for', () => {
    const accepted = RunRecord.empty(RUN, WORKSPACE)
      .recordEnd(endOf())
      .recordAction(NextAct.of('approved', AT))
      .recordAction(NextAct.of('closed', LATER));

    expect(accepted.next?.accepts).toBe(true);
    expect(accepted.turnout).toBe('accepted');
  });

  it('turned out sent back when a person sent it back after approving a tool it asked for', () => {
    const sentBack = RunRecord.empty(RUN, WORKSPACE)
      .recordEnd(endOf())
      .recordAction(NextAct.of('approved', AT))
      .recordAction(NextAct.of('sent-back', LATER));

    expect(sentBack.next?.sendsBack).toBe(true);
    expect(sentBack.turnout).toBe('sent-back');
  });

  it('turned out accepted when a person closed its task after refusing a tool it asked for', () => {
    const accepted = RunRecord.empty(RUN, WORKSPACE)
      .recordEnd(endOf())
      .recordAction(NextAct.of('refused', AT))
      .recordAction(NextAct.of('closed', LATER));

    expect(accepted.next?.accepts).toBe(true);
    expect(accepted.turnout).toBe('accepted');
  });

  it('turned out failed when it failed and nobody accepted or sent it back', () => {
    expect(
      RunRecord.empty(RUN, WORKSPACE)
        .recordEnd(endOf({ ending: 'failed' }))
        .recordAction(NextAct.of('answered', AT)).turnout,
    ).toBe('failed');
  });

  it('turned out asking when a person answered what it asked', () => {
    expect(
      RunRecord.empty(RUN, WORKSPACE)
        .recordEnd(endOf())
        .recordAction(NextAct.of('answered', AT)).turnout,
    ).toBe('asked');
  });

  it('turned out asking, neither accepted nor sent back, when a person only decided a tool or permission approval', () => {
    const ended = RunRecord.empty(RUN, WORKSPACE).recordEnd(endOf());

    for (const act of ['approved', 'refused'] as const) {
      const decided = ended.recordAction(NextAct.of(act, AT));

      expect(decided.turnout).toBe('asked');
      expect(decided.next).toBeNull();
    }
  });

  it('turned out failed when it failed after a person decided a tool it asked for', () => {
    expect(
      RunRecord.empty(RUN, WORKSPACE)
        .recordEnd(endOf({ ending: 'failed' }))
        .recordAction(NextAct.of('approved', AT)).turnout,
    ).toBe('failed');
  });

  it('turned out asking when a person parked its task after deciding a tool it asked for', () => {
    expect(
      RunRecord.empty(RUN, WORKSPACE)
        .recordEnd(endOf())
        .recordAction(NextAct.of('approved', AT))
        .recordAction(NextAct.of('parked', LATER)).turnout,
    ).toBe('asked');
  });

  it('turned out asking when it ended waiting on a person nobody has answered yet', () => {
    expect(
      RunRecord.empty(RUN, WORKSPACE).recordEnd(endOf({ asked: true })).turnout,
    ).toBe('asked');
  });

  it('turned out some other way when nothing told how', () => {
    expect(RunRecord.empty(RUN, WORKSPACE).turnout).toBe('other');
    expect(RunRecord.empty(RUN, WORKSPACE).recordEnd(endOf()).turnout).toBe(
      'other',
    );
    expect(
      RunRecord.empty(RUN, WORKSPACE)
        .recordEnd(endOf())
        .recordAction(NextAct.of('parked', AT)).turnout,
    ).toBe('other');
  });

  it('failed after calling a server only when it failed and its last call there failed', () => {
    const timed = LatencyHistogram.timing([100, 200]);
    const used = RunTools.of({
      servers: [
        {
          server: 'linear',
          calls: 2,
          failed: 1,
          latency: timed,
          lastCallFailed: true,
        },
        {
          server: 'sentry',
          calls: 2,
          failed: 1,
          latency: timed,
          lastCallFailed: false,
        },
      ],
      skillsRead: [],
    });
    const failed = endedRecord('run_1', { ending: 'failed' }).recordDigest(
      costOf(),
      used,
    );
    const completed = endedRecord('run_2').recordDigest(costOf(), used);

    expect(failed.failedAfterCallingTo('linear')).toBe(true);
    expect(failed.failedAfterCallingTo('sentry')).toBe(false);
    expect(failed.failedAfterCallingTo('wiki')).toBe(false);
    expect(completed.failedAfterCallingTo('linear')).toBe(false);
  });

  it('keeps the memories a run used, received before or after it ended, and records no event for them', () => {
    const briefed = RunRecord.empty(RUN, WORKSPACE).recordMemories('briefed', [
      'mem_1',
    ]);
    const ended = briefed
      .recordEnd(endOf())
      .recordMemories('recalled', ['mem_2']);

    expect(ended.memories.briefed).toEqual(['mem_1']);
    expect(ended.memories.recalled).toEqual(['mem_2']);
    expect(ended.recordMemories('recalled', ['mem_2'])).toBe(ended);
    expect(briefed.recordMemories('briefed', ['mem_3']).pullEvents()).toEqual(
      [],
    );
  });

  it('keeps the memories it used when looked at as of an earlier time', () => {
    const used = RunRecord.empty(RUN, WORKSPACE)
      .recordEnd(endOf())
      .recordMemories('briefed', ['mem_1']);

    expect(used.asOf(EARLIER).memories).toBe(used.memories);
  });
});
