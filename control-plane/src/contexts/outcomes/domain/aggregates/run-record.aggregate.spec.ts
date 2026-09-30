import { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import { InvalidOutcomeError } from '@outcomes/domain/exceptions/invalid-outcome.error';
import {
  endedRecord,
  endOf,
  WORKSPACE,
} from '@outcomes/domain/outcomes.fake-spec';
import { NextAct } from '@outcomes/domain/value-objects/next-act.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const RUN = RunId.of('run_1');
const AT = new Date('2026-09-30T11:00:00.000Z');
const LATER = new Date('2026-09-30T12:00:00.000Z');

describe('RunRecord', () => {
  it('has no ending until the run ends', () => {
    const heard = RunRecord.heardOf(RUN, WORKSPACE);

    expect(heard.hasEnded).toBe(false);
    expect(heard.ending).toBeNull();
  });

  it('keeps the first end it hears of', () => {
    const ended = RunRecord.heardOf(RUN, WORKSPACE).ended(
      endOf({ ending: 'failed' }),
    );

    expect(ended.ended(endOf({ ending: 'completed' }))).toBe(ended);
    expect(ended.ending).toBe('failed');
  });

  it('ends as superseded when its task superseded it after it ended', () => {
    expect(endedRecord('run_1').supersededByItsTask().ending).toBe(
      'superseded',
    );
  });

  it('ends as superseded when told so before it was heard to end', () => {
    const superseded = RunRecord.heardOf(RUN, WORKSPACE)
      .supersededByItsTask()
      .ended(endOf({ ending: 'completed' }));

    expect(superseded.ending).toBe('superseded');
  });

  it('is left as it is when superseded twice', () => {
    const superseded = endedRecord('run_1').supersededByItsTask();

    expect(superseded.supersededByItsTask()).toBe(superseded);
  });

  it('keeps the first verdict on its change', () => {
    const failed = endedRecord('run_1').checked('failed');

    expect(failed.checked('passed')).toBe(failed);
    expect(failed.checks).toBe('failed');
  });

  it('takes a real verdict over a skipped check, in either order', () => {
    const skippedFirst = endedRecord('run_1')
      .checked('skipped')
      .checked('passed');
    const passedFirst = endedRecord('run_1')
      .checked('passed')
      .checked('skipped');

    expect(skippedFirst.checks).toBe('passed');
    expect(passedFirst.checks).toBe('passed');
  });

  it('takes its verdict before it is heard to end', () => {
    const checked = RunRecord.heardOf(RUN, WORKSPACE)
      .checked('passed')
      .ended(endOf());

    expect(checked.checks).toBe('passed');
  });

  it('counts only the first thing a person did after it', () => {
    const acted = endedRecord('run_1').actedOn(NextAct.of('sent-back', AT));

    expect(acted.actedOn(NextAct.of('approved', LATER))).toBe(acted);
    expect(acted.next?.act).toBe('sent-back');
    expect(acted.next?.at).toEqual(AT);
  });

  it('keeps its version until it is saved', () => {
    const record = RunRecord.rehydrate({
      runId: RUN,
      workspaceId: WORKSPACE,
      taskId: TaskId.of('task_1'),
      end: endOf(),
      superseded: false,
      checks: null,
      next: null,
      version: 3,
    });

    expect(
      record.checked('passed').actedOn(NextAct.of('closed', AT)).version,
    ).toBe(3);
  });

  it('knows its task once it ends, or when heard of with it', () => {
    expect(RunRecord.heardOf(RUN, WORKSPACE).taskId).toBeNull();
    expect(
      RunRecord.heardOf(RUN, WORKSPACE, TaskId.of('task_2')).taskId?.value,
    ).toBe('task_2');
    expect(
      RunRecord.heardOf(RUN, WORKSPACE).ended(endOf({ taskId: 'task_3' }))
        .taskId?.value,
    ).toBe('task_3');
  });

  it('did not run when it was withdrawn from the queue, even once superseded', () => {
    const withdrawn = endedRecord('run_1', { ending: 'withdrawn' });

    expect(withdrawn.ran).toBe(false);
    expect(withdrawn.supersededByItsTask().ran).toBe(false);
    expect(endedRecord('run_2', { ending: 'failed' }).ran).toBe(true);
    expect(RunRecord.heardOf(RUN, WORKSPACE).ran).toBe(false);
  });

  it('refuses to end on another task than the one it was heard of for', () => {
    expect(() =>
      RunRecord.heardOf(RUN, WORKSPACE, TaskId.of('task_2')).ended(
        endOf({ taskId: 'task_1' }),
      ),
    ).toThrow(InvalidOutcomeError);
  });

  it('is stored ending on the task it is held under', () => {
    expect(() =>
      RunRecord.rehydrate({
        runId: RUN,
        workspaceId: WORKSPACE,
        taskId: TaskId.of('task_2'),
        end: endOf({ taskId: 'task_1' }),
        superseded: false,
        checks: null,
        next: null,
        version: 0,
      }),
    ).toThrow(InvalidOutcomeError);
  });
});
