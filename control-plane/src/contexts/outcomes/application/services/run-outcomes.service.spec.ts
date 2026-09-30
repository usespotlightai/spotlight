import { RunOutcomes } from '@outcomes/application/services/run-outcomes.service';
import { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import {
  endedRecord,
  FIRST_CONFIG,
  RunRecordsInMemory,
  TaskDeliveriesInMemory,
  WORKSPACE,
} from '@outcomes/domain/outcomes.fake-spec';
import { NextAct } from '@outcomes/domain/value-objects/next-act.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-09-30T11:00:00.000Z');

describe('RunOutcomes', () => {
  it('tells Work how each ended run turned out, with its task’s delivery', async () => {
    const records = new RunRecordsInMemory();
    const deliveries = new TaskDeliveriesInMemory();
    await records.add(
      endedRecord('run_1', { round: 2 })
        .checked('passed')
        .actedOn(NextAct.of('approved', AT)),
    );
    await records.add(RunRecord.heardOf(RunId.of('run_2'), WORKSPACE));
    await deliveries.add(
      TaskDelivery.opened({
        taskId: TaskId.of('task_1'),
        workspaceId: WORKSPACE,
        pullRequest: PullRequestUrl.of('https://github.com/acme/api/pull/1'),
      }),
    );

    const outcomes = await new RunOutcomes(records, deliveries).of([
      'run_1',
      'run_2',
      'run_3',
    ]);

    expect([...outcomes.keys()]).toEqual(['run_1']);
    expect(outcomes.get('run_1')).toEqual({
      runId: 'run_1',
      fingerprint: FIRST_CONFIG,
      endedAt: '2026-09-30T10:00:00.000Z',
      ending: 'completed',
      failure: null,
      round: 2,
      checks: 'passed',
      next: { act: 'approved', at: AT.toISOString() },
      delivery: 'open',
    });
  });

  it('tells nothing when asked of no runs', async () => {
    const outcomes = await new RunOutcomes(
      new RunRecordsInMemory(),
      new TaskDeliveriesInMemory(),
    ).of([]);

    expect(outcomes.size).toBe(0);
  });
});
