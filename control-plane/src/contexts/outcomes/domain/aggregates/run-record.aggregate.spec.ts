import { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import { RunRecordEnded } from '@outcomes/domain/events/run-record-ended.event';
import { RunRecordSettled } from '@outcomes/domain/events/run-record-settled.event';
import { InvalidOutcomeError } from '@outcomes/domain/exceptions/invalid-outcome.error';
import {
  costOf,
  endedRecord,
  endOf,
  WORKSPACE,
} from '@outcomes/domain/outcomes.fake-spec';
import { HandedOn } from '@outcomes/domain/value-objects/handed-on.vo';
import { NextAct } from '@outcomes/domain/value-objects/next-act.vo';
import { Refusal } from '@outcomes/domain/value-objects/refusal.vo';
import type { RunCost } from '@outcomes/domain/value-objects/run-cost.vo';
import { RunMemories } from '@outcomes/domain/value-objects/run-memories.vo';
import { RunTools } from '@outcomes/domain/value-objects/run-tools.vo';
import { LatencyHistogram } from '@shared-kernel/domain/value-objects/latency-histogram.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const HEARD_AT = new Date('2026-09-30T12:00:00.000Z');

const RUN = RunId.of('run_1');
const EARLIER = new Date('2026-09-30T10:00:00.000Z');
const AT = new Date('2026-09-30T11:00:00.000Z');
const LATER = new Date('2026-09-30T12:00:00.000Z');

describe('RunRecord', () => {
  it('has no ending until the run ends', () => {
    const heard = RunRecord.heardOf(RUN, WORKSPACE);

    expect(heard.hasEnded).toBe(false);
    expect(heard.ending).toBeNull();
  });

  it('tells once that it ended, at the station it ended at, through later changes', () => {
    const ended = RunRecord.heardOf(RUN, WORKSPACE)
      .recordEnd(endOf())
      .recordEnd(endOf({ stationId: 'station_2' }))
      .recordAction(NextAct.of('closed', AT));

    const events = ended.pullEvents();
    expect(events.map((each) => each.kind)).toEqual([
      'run-record.ended',
      'run-record.settled',
    ]);
    expect(events[0]).toBeInstanceOf(RunRecordEnded);
    expect((events[0] as RunRecordEnded).place.stationId).toBe('station_1');
    expect(ended.pullEvents()).toEqual([]);
  });

  it('tells it settled once for each outcome it learns after it ended, and not for one it already knew', () => {
    const heard = RunRecord.heardOf(RUN, WORKSPACE).recordAction(
      NextAct.of('closed', AT),
    );
    expect(heard.pullEvents()).toEqual([]);

    const learned = heard
      .recordEnd(endOf())
      .recordAction(NextAct.of('sent-back', LATER))
      .recordAction(NextAct.of('approved', LATER))
      .recordAction(NextAct.of('refused', LATER))
      .recordCheck('skipped', HEARD_AT)
      .recordCheck('passed', HEARD_AT)
      .recordCheck('failed', HEARD_AT)
      .recordDigest(costOf(), RunTools.NONE)
      .recordDigest(costOf({ amount: 2 }), RunTools.NONE);

    const events = learned.pullEvents();
    expect(events.map((each) => each.kind)).toEqual([
      'run-record.ended',
      'run-record.settled',
      'run-record.settled',
      'run-record.settled',
      'run-record.settled',
    ]);
    expect(events[1]).toBeInstanceOf(RunRecordSettled);
    expect((events[1] as RunRecordSettled).place.stationId).toBe('station_1');
  });

  it('keeps the first end it hears of', () => {
    const ended = RunRecord.heardOf(RUN, WORKSPACE).recordEnd(
      endOf({ ending: 'failed' }),
    );

    expect(ended.recordEnd(endOf({ ending: 'completed' }))).toBe(ended);
    expect(ended.ending).toBe('failed');
  });

  it('ends as superseded when its task superseded it after it ended', () => {
    expect(endedRecord('run_1').supersededByItsTask(HEARD_AT).ending).toBe(
      'superseded',
    );
  });

  it('ends as superseded when told so before it was heard to end', () => {
    const superseded = RunRecord.heardOf(RUN, WORKSPACE)
      .supersededByItsTask(HEARD_AT)
      .recordEnd(endOf({ ending: 'completed' }));

    expect(superseded.ending).toBe('superseded');
  });

  it('is left as it is when superseded twice', () => {
    const superseded = endedRecord('run_1').supersededByItsTask(HEARD_AT);

    expect(superseded.supersededByItsTask(HEARD_AT)).toBe(superseded);
  });

  it('keeps the first verdict on its change', () => {
    const failed = endedRecord('run_1').recordCheck('failed', HEARD_AT);

    expect(failed.recordCheck('passed', HEARD_AT)).toBe(failed);
    expect(failed.checks).toBe('failed');
  });

  it('takes a real verdict over a skipped check, in either order', () => {
    const skippedFirst = endedRecord('run_1')
      .recordCheck('skipped', HEARD_AT)
      .recordCheck('passed', HEARD_AT);
    const passedFirst = endedRecord('run_1')
      .recordCheck('passed', HEARD_AT)
      .recordCheck('skipped', HEARD_AT);

    expect(skippedFirst.checks).toBe('passed');
    expect(passedFirst.checks).toBe('passed');
  });

  it('takes its verdict before it is heard to end', () => {
    const checked = RunRecord.heardOf(RUN, WORKSPACE)
      .recordCheck('passed', HEARD_AT)
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

  it('counts the first thing a person did after it, in whatever order it hears of what they did', () => {
    const acts = [
      NextAct.of('approved', EARLIER),
      NextAct.of('sent-back', AT),
      NextAct.of('refused', AT),
      NextAct.of('closed', LATER),
    ];
    const heardIn = (order: readonly NextAct[]) =>
      order.reduce(
        (record, act) => record.recordAction(act),
        endedRecord('run_1'),
      );

    for (const order of [
      acts,
      [...acts].reverse(),
      [acts[3], acts[0], acts[2], acts[1]],
    ]) {
      const heard = heardIn(order);

      expect(heard.next?.act).toBe('sent-back');
      expect(heard.approvalAnsweredAt).toEqual(EARLIER);
      expect(heard.turnout).toBe('sent-back');
    }
  });

  it('decides between acts at the same moment the same way whichever it hears first', () => {
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

  it('refuses to be read back decided by answering an approval', () => {
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
        handedOn: null,
        tools: null,
        refusals: [],
        memories: RunMemories.NONE,
        version: 0,
      }),
    ).toThrow(InvalidOutcomeError);
  });

  it('forgets an approval answered after the moment it is read as of', () => {
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
      handedOn: null,
      tools: null,
      refusals: [],
      memories: RunMemories.NONE,
      version: 3,
    });

    expect(
      record
        .recordCheck('passed', HEARD_AT)
        .recordAction(NextAct.of('closed', AT)).version,
    ).toBe(3);
  });

  it('knows its task once it ends, or when heard of with it', () => {
    expect(RunRecord.heardOf(RUN, WORKSPACE).taskId).toBeNull();
    expect(
      RunRecord.heardOf(RUN, WORKSPACE, TaskId.of('task_2')).taskId?.value,
    ).toBe('task_2');
    expect(
      RunRecord.heardOf(RUN, WORKSPACE).recordEnd(endOf({ taskId: 'task_3' }))
        .taskId?.value,
    ).toBe('task_3');
  });

  it('did not run when it was withdrawn from the queue, even once superseded', () => {
    const withdrawn = endedRecord('run_1', { ending: 'withdrawn' });

    expect(withdrawn.ran).toBe(false);
    expect(withdrawn.supersededByItsTask(HEARD_AT).ran).toBe(false);
    expect(endedRecord('run_2', { ending: 'failed' }).ran).toBe(true);
    expect(RunRecord.heardOf(RUN, WORKSPACE).ran).toBe(false);
  });

  it('refuses to end on another task than the one it was heard of for', () => {
    expect(() =>
      RunRecord.heardOf(RUN, WORKSPACE, TaskId.of('task_2')).recordEnd(
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
        handedOn: null,
        tools: null,
        refusals: [],
        memories: RunMemories.NONE,
        version: 0,
      }),
    ).toThrow(InvalidOutcomeError);
  });

  it('keeps the first cost it hears of, before or after it ended', () => {
    const digested = RunRecord.heardOf(RUN, WORKSPACE).recordDigest(
      costOf({ amount: 0.4 }),
      RunTools.NONE,
    );
    const ended = digested.recordEnd(endOf());

    expect(ended.cost?.spend?.amount).toBe(0.4);
    expect(ended.recordDigest(costOf({ amount: 9 }), RunTools.NONE)).toBe(
      ended,
    );
  });

  it('keeps the first station it handed its task on to', () => {
    const handed = endedRecord('run_1').handedOnTo(
      HandedOn.of('station_2', AT),
    );

    expect(handed.handedOnTo(HandedOn.of('station_3', LATER))).toBe(handed);
    expect(handed.handedOn?.to).toBe('station_2');
  });

  it('keeps the tools it used with the first digest it hears of', () => {
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
        handedOn: null,
        tools,
        refusals: [],
        memories: RunMemories.NONE,
        version: 0,
      });

    expect(() => stored(null, RunTools.NONE)).toThrow(InvalidOutcomeError);
    expect(stored(costOf(), null).tools).toBeNull();
  });

  it('notes each refusal once, however often it is heard', () => {
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
    const ended = RunRecord.heardOf(RUN, WORKSPACE).recordEnd(
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
    const accepted = RunRecord.heardOf(RUN, WORKSPACE)
      .recordEnd(endOf())
      .recordAction(NextAct.of('approved', AT))
      .recordAction(NextAct.of('closed', LATER));

    expect(accepted.next?.accepts).toBe(true);
    expect(accepted.turnout).toBe('accepted');
  });

  it('turned out sent back when a person sent it back after approving a tool it asked for', () => {
    const sentBack = RunRecord.heardOf(RUN, WORKSPACE)
      .recordEnd(endOf())
      .recordAction(NextAct.of('approved', AT))
      .recordAction(NextAct.of('sent-back', LATER));

    expect(sentBack.next?.sendsBack).toBe(true);
    expect(sentBack.turnout).toBe('sent-back');
  });

  it('turned out accepted when a person closed its task after refusing a tool it asked for', () => {
    const accepted = RunRecord.heardOf(RUN, WORKSPACE)
      .recordEnd(endOf())
      .recordAction(NextAct.of('refused', AT))
      .recordAction(NextAct.of('closed', LATER));

    expect(accepted.next?.accepts).toBe(true);
    expect(accepted.turnout).toBe('accepted');
  });

  it('turned out failed when it failed and nobody accepted or sent it back', () => {
    expect(
      RunRecord.heardOf(RUN, WORKSPACE)
        .recordEnd(endOf({ ending: 'failed' }))
        .recordAction(NextAct.of('answered', AT)).turnout,
    ).toBe('failed');
  });

  it('turned out asking when a person answered what it asked', () => {
    expect(
      RunRecord.heardOf(RUN, WORKSPACE)
        .recordEnd(endOf())
        .recordAction(NextAct.of('answered', AT)).turnout,
    ).toBe('asked');
  });

  it('turned out asking, neither accepted nor sent back, when a person only decided a tool or permission approval', () => {
    const ended = RunRecord.heardOf(RUN, WORKSPACE).recordEnd(endOf());

    for (const act of ['approved', 'refused'] as const) {
      const decided = ended.recordAction(NextAct.of(act, AT));

      expect(decided.turnout).toBe('asked');
      expect(decided.next).toBeNull();
    }
  });

  it('turned out failed when it failed after a person decided a tool it asked for', () => {
    expect(
      RunRecord.heardOf(RUN, WORKSPACE)
        .recordEnd(endOf({ ending: 'failed' }))
        .recordAction(NextAct.of('approved', AT)).turnout,
    ).toBe('failed');
  });

  it('turned out asking when a person parked its task after deciding a tool it asked for', () => {
    expect(
      RunRecord.heardOf(RUN, WORKSPACE)
        .recordEnd(endOf())
        .recordAction(NextAct.of('approved', AT))
        .recordAction(NextAct.of('parked', LATER)).turnout,
    ).toBe('asked');
  });

  it('turned out asking when it ended waiting on a person nobody has answered yet', () => {
    expect(
      RunRecord.heardOf(RUN, WORKSPACE).recordEnd(endOf({ asked: true }))
        .turnout,
    ).toBe('asked');
  });

  it('turned out some other way when nothing told how', () => {
    expect(RunRecord.heardOf(RUN, WORKSPACE).turnout).toBe('other');
    expect(RunRecord.heardOf(RUN, WORKSPACE).recordEnd(endOf()).turnout).toBe(
      'other',
    );
    expect(
      RunRecord.heardOf(RUN, WORKSPACE)
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

  it('keeps the memories a run used, heard before or after it ended, and records no event for them', () => {
    const briefed = RunRecord.heardOf(RUN, WORKSPACE).recordMemories(
      'briefed',
      ['mem_1'],
    );
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
    const used = RunRecord.heardOf(RUN, WORKSPACE)
      .recordEnd(endOf())
      .recordMemories('briefed', ['mem_1']);

    expect(used.asOf(EARLIER).memories).toBe(used.memories);
  });
});
