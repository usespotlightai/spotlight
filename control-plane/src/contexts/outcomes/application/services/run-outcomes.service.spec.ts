import { RunOutcomes } from '@outcomes/application/services/run-outcomes.service';
import { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import {
  endedRecord,
  FIRST_CONFIG,
  RunRecordsInMemory,
  TaskDeliveriesInMemory,
  TEAM,
  WORKSPACE,
} from '@outcomes/domain/outcomes.fake-spec';
import { NextAct } from '@outcomes/domain/value-objects/next-act.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const RECEIVED_AT = new Date('2026-09-30T12:00:00.000Z');

const AT = new Date('2026-09-30T11:00:00.000Z');

describe('RunOutcomes', () => {
  it('tells Work how each ended run turned out, with its task’s delivery', async () => {
    const records = new RunRecordsInMemory();
    const deliveries = new TaskDeliveriesInMemory();
    await records.add(
      endedRecord('run_1', { round: 2 })
        .recordCheck('passed', RECEIVED_AT)
        .recordAction(NextAct.of('closed', AT)),
    );
    await records.add(RunRecord.empty(RunId.of('run_2'), WORKSPACE));
    await deliveries.add(
      TaskDelivery.open({
        taskId: TaskId.of('task_1'),
        workspaceId: WORKSPACE,
        teamId: TEAM,
        pullRequest: PullRequestUrl.of('https://github.com/acme/api/pull/1'),
        at: AT,
      }),
    );

    const outcomes = await new RunOutcomes(records, deliveries).of(
      ['run_1', 'run_2', 'run_3'],
      null,
    );

    expect([...outcomes.keys()]).toEqual(['run_1']);
    expect(outcomes.get('run_1')).toEqual({
      runId: 'run_1',
      fingerprint: FIRST_CONFIG,
      endedAt: '2026-09-30T10:00:00.000Z',
      ending: 'completed',
      failure: null,
      round: 2,
      checks: 'passed',
      next: { act: 'closed', at: AT.toISOString() },
      delivery: 'open',
    });
  });

  it('tells nothing for a query of no runs', async () => {
    const outcomes = await new RunOutcomes(
      new RunRecordsInMemory(),
      new TaskDeliveriesInMemory(),
    ).of([], null);

    expect(outcomes.size).toBe(0);
  });

  it('tells a replay only what was known when the run it replays started', async () => {
    const records = new RunRecordsInMemory();
    const deliveries = new TaskDeliveriesInMemory();
    const later = (hours: number) =>
      new Date(AT.getTime() + hours * 60 * 60_000);
    const pullRequest = PullRequestUrl.of('https://github.com/acme/api/pull/1');
    await records.add(
      endedRecord('run_1', { round: 2 })
        .recordCheck('passed', later(2))
        .recordAction(NextAct.of('closed', later(3)))
        .supersededByItsTask(later(4)),
    );
    await deliveries.add(
      TaskDelivery.open({
        taskId: TaskId.of('task_1'),
        workspaceId: WORKSPACE,
        teamId: TEAM,
        pullRequest,
        at: later(1),
      }).close({ pullRequest, merged: true, at: later(5) }),
    );
    const of = (asOf: Date) =>
      new RunOutcomes(records, deliveries)
        .of(['run_1'], asOf)
        .then((outcomes) => outcomes.get('run_1'));

    expect(await of(AT)).toMatchObject({
      ending: 'completed',
      checks: null,
      next: null,
      delivery: null,
    });
    expect(await of(later(2))).toMatchObject({
      checks: 'passed',
      next: null,
      delivery: 'open',
    });
    expect(await of(later(6))).toMatchObject({
      ending: 'superseded',
      checks: 'passed',
      next: { act: 'closed' },
      delivery: 'merged',
    });
  });
});
