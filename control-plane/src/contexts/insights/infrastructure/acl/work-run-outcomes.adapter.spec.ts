import { RunOutcomes } from '@insights/application/services/run-outcomes.service';
import { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import { HumanAction } from '@insights/domain/value-objects/human-action.vo';
import { WorkRunOutcomes } from '@insights/infrastructure/acl/work-run-outcomes.adapter';
import { taskPullRequestOf } from '@insights/insights.fake-spec';
import { PullRequestRecordsInMemory } from '@insights/pull-requests.fake-spec';
import {
  endedRecord,
  FIRST_CONFIG,
  RunRecordsInMemory,
  StationFactsInMemory,
  WORKSPACE,
} from '@insights/runs.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const RECEIVED_AT = new Date('2026-09-30T12:00:00.000Z');

const AT = new Date('2026-09-30T11:00:00.000Z');

describe('WorkRunOutcomes', () => {
  it('tells Work how each ended run turned out, with the state of its task’s pull request', async () => {
    const records = new RunRecordsInMemory();
    const taskPullRequests = new PullRequestRecordsInMemory();
    await records.add(
      endedRecord('run_1', { visit: 2 })
        .recordCheck('passed', RECEIVED_AT)
        .recordAction(HumanAction.of('accepted', AT)),
    );
    await records.add(RunRecord.empty(RunId.of('run_2'), WORKSPACE));
    await taskPullRequests.add(taskPullRequestOf('task_1', { openedAt: AT }));

    const outcomes = await new WorkRunOutcomes(
      new RunOutcomes(
        new StationFactsInMemory(records, { pullRequests: taskPullRequests }),
      ),
    ).of(['run_1', 'run_2', 'run_3'], null);

    expect([...outcomes.keys()]).toEqual(['run_1']);
    expect(outcomes.get('run_1')).toEqual({
      runId: 'run_1',
      fingerprint: FIRST_CONFIG,
      endedAt: '2026-09-30T10:00:00.000Z',
      ending: 'completed',
      failure: null,
      visit: 2,
      checks: 'passed',
      firstHumanAction: { kind: 'accepted', at: AT.toISOString() },
      pullRequestState: 'open',
    });
  });

  it('tells nothing for a query of no runs', async () => {
    const outcomes = await new WorkRunOutcomes(
      new RunOutcomes(new StationFactsInMemory(new RunRecordsInMemory())),
    ).of([], null);

    expect(outcomes.size).toBe(0);
  });

  it('tells a replay only what was known when the run it replays started', async () => {
    const records = new RunRecordsInMemory();
    const taskPullRequests = new PullRequestRecordsInMemory();
    const later = (hours: number) =>
      new Date(AT.getTime() + hours * 60 * 60_000);
    await records.add(
      endedRecord('run_1', { visit: 2 })
        .recordCheck('passed', later(2))
        .recordAction(HumanAction.of('accepted', later(3)))
        .supersededByItsTask(later(4)),
    );
    await taskPullRequests.add(
      taskPullRequestOf('task_1', {
        openedAt: later(1),
        closedAt: later(5),
        merged: true,
      }),
    );
    const of = (asOf: Date) =>
      new WorkRunOutcomes(
        new RunOutcomes(
          new StationFactsInMemory(records, { pullRequests: taskPullRequests }),
        ),
      )
        .of(['run_1'], asOf)
        .then((outcomes) => outcomes.get('run_1'));

    expect(await of(AT)).toMatchObject({
      ending: 'completed',
      checks: null,
      firstHumanAction: null,
      pullRequestState: null,
    });
    expect(await of(later(2))).toMatchObject({
      checks: 'passed',
      firstHumanAction: null,
      pullRequestState: 'open',
    });
    expect(await of(later(6))).toMatchObject({
      ending: 'superseded',
      checks: 'passed',
      firstHumanAction: { kind: 'accepted' },
      pullRequestState: 'merged',
    });
  });
});
