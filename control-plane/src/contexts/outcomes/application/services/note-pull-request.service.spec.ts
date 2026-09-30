import { ForgetOutcomes } from '@outcomes/application/services/forget-outcomes.service';
import { NotePullRequestClosed } from '@outcomes/application/services/note-pull-request-closed.service';
import { NotePullRequestOpened } from '@outcomes/application/services/note-pull-request-opened.service';
import { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import {
  JudgingsInMemory,
  ScoresInMemory,
} from '@outcomes/domain/judging.fake-spec';
import {
  endedRecord,
  inTransaction,
  RunRecordsInMemory,
  TaskDeliveriesInMemory,
  WORKSPACE,
} from '@outcomes/domain/outcomes.fake-spec';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const TASK = TaskId.of('task_1');
const PULL = PullRequestUrl.of('https://github.com/acme/api/pull/7');
const AT = new Date('2026-09-30T12:00:00.000Z');

const delivering = () => {
  const deliveries = new TaskDeliveriesInMemory();

  return {
    deliveries,
    opened: (pullRequest = PULL) =>
      new NotePullRequestOpened(deliveries, inTransaction).opened(
        TASK,
        WORKSPACE,
        pullRequest,
      ),
    closed: (merged: boolean, workspaceId = WORKSPACE) =>
      new NotePullRequestClosed(deliveries, inTransaction).closed({
        workspaceId,
        pullRequest: PULL,
        merged,
        at: AT,
      }),
    state: async () => (await deliveries.forTask(TASK))?.state ?? null,
  };
};

describe('noting a task’s pull request', () => {
  it('holds it open once the task opens it', async () => {
    const noted = delivering();

    await noted.opened();

    expect(await noted.state()).toBe('open');
  });

  it('holds it merged once it merges', async () => {
    const noted = delivering();
    await noted.opened();

    await noted.closed(true);

    expect(await noted.state()).toBe('merged');
    expect((await noted.deliveries.forTask(TASK))?.closedAt).toEqual(AT);
  });

  it('changes nothing when the same pull request is opened again', async () => {
    const noted = delivering();
    await noted.opened();
    await noted.closed(true);

    await noted.opened();

    expect(await noted.state()).toBe('merged');
  });

  it('ignores a pull request no task opened, or one in another workspace', async () => {
    const noted = delivering();
    await noted.closed(true);
    await noted.opened();

    await noted.closed(true, WorkspaceId.of('ws_2'));

    expect(await noted.state()).toBe('open');
  });
});

describe('forgetting outcomes', () => {
  it('forgets a deleted task’s runs and its delivery', async () => {
    const records = new RunRecordsInMemory();
    const noted = delivering();
    await records.add(endedRecord('run_1'));
    await records.add(endedRecord('run_2', { taskId: 'task_2' }));
    await noted.opened();
    const forgetting = new ForgetOutcomes(
      records,
      noted.deliveries,
      new JudgingsInMemory(),
      new ScoresInMemory(),
      inTransaction,
    );

    await forgetting.runsOfTask(TASK);
    await forgetting.deliveryOfTask(TASK);

    expect(await records.of(RunId.of('run_1'))).toBeNull();
    expect(await records.of(RunId.of('run_2'))).not.toBeNull();
    expect(await noted.state()).toBeNull();
  });

  it('forgets what it heard of a deleted task’s runs before they ended', async () => {
    const records = new RunRecordsInMemory();
    await records.add(
      RunRecord.heardOf(RunId.of('run_1'), WORKSPACE, TASK).checked('passed'),
    );

    await new ForgetOutcomes(
      records,
      new TaskDeliveriesInMemory(),
      new JudgingsInMemory(),
      new ScoresInMemory(),
      inTransaction,
    ).runsOfTask(TASK);

    expect(records.held.size).toBe(0);
  });

  it('forgets everything of a closed workspace', async () => {
    const records = new RunRecordsInMemory();
    const noted = delivering();
    await records.add(endedRecord('run_1'));
    await noted.opened();
    const forgetting = new ForgetOutcomes(
      records,
      noted.deliveries,
      new JudgingsInMemory(),
      new ScoresInMemory(),
      inTransaction,
    );

    await forgetting.runsOfWorkspace(WORKSPACE);
    await forgetting.deliveriesOfWorkspace(WORKSPACE);

    expect(records.held.size).toBe(0);
    expect(noted.deliveries.held.size).toBe(0);
  });
});
