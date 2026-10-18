import { RunOutcomes } from '@insights/application/services/run-outcomes.service';
import { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import { TaskPullRequest } from '@insights/domain/aggregates/task-pull-request.aggregate';
import {
  endedRecord,
  FIRST_CONFIG,
  RunRecordsInMemory,
  TaskPullRequestsInMemory,
  TEAM,
  WORKSPACE,
} from '@insights/domain/runs.fake-spec';
import { HumanAction } from '@insights/domain/value-objects/human-action.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const RECEIVED_AT = new Date('2026-09-30T12:00:00.000Z');

const AT = new Date('2026-09-30T11:00:00.000Z');

describe('RunOutcomes', () => {
  it('tells Work how each ended run turned out, with the state of its task’s pull request', async () => {
    const records = new RunRecordsInMemory();
    const taskPullRequests = new TaskPullRequestsInMemory();
    await records.add(
      endedRecord('run_1', { visit: 2 })
        .recordCheck('passed', RECEIVED_AT)
        .recordAction(HumanAction.of('accepted', AT)),
    );
    await records.add(RunRecord.empty(RunId.of('run_2'), WORKSPACE));
    await taskPullRequests.add(
      TaskPullRequest.open({
        taskId: TaskId.of('task_1'),
        workspaceId: WORKSPACE,
        teamId: TEAM,
        pullRequest: PullRequestUrl.of('https://github.com/acme/api/pull/1'),
        at: AT,
      }),
    );

    const outcomes = await new RunOutcomes(records, taskPullRequests).of(
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
      visit: 2,
      checks: 'passed',
      firstHumanAction: { kind: 'accepted', at: AT.toISOString() },
      pullRequestState: 'open',
    });
  });

  it('tells nothing for a query of no runs', async () => {
    const outcomes = await new RunOutcomes(
      new RunRecordsInMemory(),
      new TaskPullRequestsInMemory(),
    ).of([], null);

    expect(outcomes.size).toBe(0);
  });

  it('tells a replay only what was known when the run it replays started', async () => {
    const records = new RunRecordsInMemory();
    const taskPullRequests = new TaskPullRequestsInMemory();
    const later = (hours: number) =>
      new Date(AT.getTime() + hours * 60 * 60_000);
    const pullRequest = PullRequestUrl.of('https://github.com/acme/api/pull/1');
    await records.add(
      endedRecord('run_1', { visit: 2 })
        .recordCheck('passed', later(2))
        .recordAction(HumanAction.of('accepted', later(3)))
        .supersededByItsTask(later(4)),
    );
    await taskPullRequests.add(
      TaskPullRequest.open({
        taskId: TaskId.of('task_1'),
        workspaceId: WORKSPACE,
        teamId: TEAM,
        pullRequest,
        at: later(1),
      }).close({ pullRequest, merged: true, at: later(5) }),
    );
    const of = (asOf: Date) =>
      new RunOutcomes(records, taskPullRequests)
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
