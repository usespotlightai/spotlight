import { deletionsInMemory } from '@insights/application/ports/deletions.fake-spec';
import type { EndedRun, WorkPort } from '@insights/application/ports/work.port';
import { RecordChangeChecks } from '@insights/application/services/record-change-checks.service';
import { RecordHumanAction } from '@insights/application/services/record-human-action.service';
import { RecordRunUsageSummary } from '@insights/application/services/record-run-usage-summary.service';
import {
  endedRecord,
  inTransaction,
  RunRecordsInMemory,
  WORKSPACE,
} from '@insights/domain/runs.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const RECEIVED_AT = new Date('2026-09-30T12:00:00.000Z');

const at = (hour: number) =>
  new Date(`2026-09-30T${String(hour).padStart(2, '0')}:00:00.000Z`);

type Ended =
  | [string, number]
  | [string, number, Parameters<typeof endedRecord>[1]];

const workOfTeam = (teamId: string): WorkPort => ({
  endedRun: async (runId) =>
    ({
      runId,
      workspaceId: 'ws_1',
      teamId,
      taskId: 'task_1',
    }) as EndedRun,
  configsInOrder: async () => [],
  teamRepositories: async () => [],
  teamSkillKeys: async () => [],
  alertsAt: async () => null,
});

const acting = async (...runs: Ended[]) => {
  const records = new RunRecordsInMemory();
  const deletions = deletionsInMemory();

  for (const [runId, hour, change] of runs) {
    await records.add(endedRecord(runId, { endedAt: at(hour), ...change }));
  }

  const service = new RecordHumanAction(
    workOfTeam('team_1'),
    records,
    deletions,
    inTransaction,
  );

  return {
    records,
    deletions,
    acted: (
      act: string,
      hour: number,
      after: string | null = null,
      tool: { tool: string; server: string | null } | null = null,
    ) =>
      service.acted({
        taskId: 'task_1',
        workspaceId: 'ws_1',
        stationId: 'station_1',
        action: act,
        afterRunId: after,
        at: at(hour).toISOString(),
        tool: tool?.tool ?? null,
        server: tool?.server ?? null,
      }),
    refusals: async (runId: string) =>
      (await records.of(RunId.of(runId)))?.refusals.map((each) => ({
        tool: each.tool,
        server: each.server,
      })) ?? [],
    disposition: async (runId: string) =>
      (await records.of(RunId.of(runId)))?.disposition ?? null,
    next: async (runId: string) =>
      (await records.of(RunId.of(runId)))?.firstHumanAction?.kind ?? null,
  };
};

describe('recording what a person did after a run', () => {
  it('notes the tool a person refused on the run that asked, once however often it is received', async () => {
    const recorder = await acting(['run_1', 9]);
    const tool = { tool: 'mcp__linear__create_issue', server: 'linear' };

    await recorder.acted('refused', 10, 'run_1', tool);
    await recorder.acted('refused', 10, 'run_1', tool);

    expect(await recorder.refusals('run_1')).toEqual([tool]);
  });

  it('notes no refusal for an approval or for a refusal that names no tool', async () => {
    const recorder = await acting(['run_1', 9]);

    await recorder.acted('approved', 10, 'run_1', {
      tool: 'mcp__linear__create_issue',
      server: 'linear',
    });
    await recorder.acted('refused', 11, 'run_1');

    expect(await recorder.refusals('run_1')).toEqual([]);
  });

  it('attributes the act to the run it names', async () => {
    const recorder = await acting(['run_1', 9], ['run_2', 10]);

    await recorder.acted('sent-back', 11, 'run_1');

    expect(await recorder.next('run_1')).toBe('sent-back');
    expect(await recorder.next('run_2')).toBeNull();
  });

  it('attributes an act that names no run to the task’s latest run that ended before it', async () => {
    const recorder = await acting(['run_1', 9], ['run_2', 10], ['run_3', 12]);

    await recorder.acted('accepted', 11);

    expect(await recorder.next('run_2')).toBe('accepted');
    expect(await recorder.next('run_1')).toBeNull();
    expect(await recorder.next('run_3')).toBeNull();
  });

  it('attributes an act that names no run to the latest run at the station the task was acted on at', async () => {
    const recorder = await acting(
      ['run_1', 9],
      ['run_2', 10, { stationId: 'station_2' }],
    );

    await recorder.acted('parked', 11);

    expect(await recorder.next('run_1')).toBe('parked');
    expect(await recorder.next('run_2')).toBeNull();
  });

  it('attributes no act to a run cancelled before it ran', async () => {
    const recorder = await acting(
      ['run_1', 9],
      ['run_2', 10, { ending: 'cancelled' }],
    );

    await recorder.acted('accepted', 11);

    expect(await recorder.next('run_1')).toBe('accepted');
    expect(await recorder.next('run_2')).toBeNull();
  });

  it('counts only the first act after a run', async () => {
    const recorder = await acting(['run_1', 9]);

    await recorder.acted('sent-back', 10);
    await recorder.acted('accepted', 11);

    expect(await recorder.next('run_1')).toBe('sent-back');
  });

  it('counts the first act after a run even when it receives a later one first', async () => {
    const recorder = await acting(['run_1', 9]);

    await recorder.acted('accepted', 12, 'run_1');
    await recorder.acted('sent-back', 10, 'run_1');

    expect(await recorder.next('run_1')).toBe('sent-back');
  });

  it('lets the act after a tool approval decide the run, not the approval', async () => {
    const tool = { tool: 'mcp__linear__create_issue', server: 'linear' };
    const decided = async (approval: 'approved' | 'refused', act: string) => {
      const recorder = await acting(['run_1', 9]);

      await recorder.acted(approval, 10, 'run_1', tool);
      await recorder.acted(act, 11, 'run_1');

      return recorder.disposition('run_1');
    };

    expect(await decided('approved', 'accepted')).toBe('accepted');
    expect(await decided('approved', 'sent-back')).toBe('sent-back');
    expect(await decided('refused', 'accepted')).toBe('accepted');
  });

  it('reads a run a person only decided a tool approval for as asking, neither accepted nor sent back', async () => {
    const recorder = await acting(['run_1', 9]);

    await recorder.acted('approved', 10, 'run_1', {
      tool: 'mcp__linear__create_issue',
      server: 'linear',
    });

    expect(await recorder.next('run_1')).toBeNull();
    expect(await recorder.disposition('run_1')).toBe('asked');
  });

  it('does not hand a later act to an earlier run already acted on', async () => {
    const recorder = await acting(['run_1', 9], ['run_2', 10]);
    await recorder.acted('sent-back', 11, 'run_2');

    await recorder.acted('accepted', 12);

    expect(await recorder.next('run_1')).toBeNull();
    expect(await recorder.next('run_2')).toBe('sent-back');
  });

  it('keeps an act that names a run, received before the run ended', async () => {
    const recorder = await acting();

    await recorder.acted('answered', 11, 'run_7');

    expect(await recorder.next('run_7')).toBe('answered');
    expect((await recorder.records.of(RunId.of('run_7')))?.taskId?.value).toBe(
      'task_1',
    );
  });

  it('keeps no act on a run of a team that was deleted', async () => {
    const recorder = await acting();
    await recorder.deletions.deleteTeam(WORKSPACE, TeamId.of('team_1'));

    await recorder.acted('refused', 11, 'run_7', {
      tool: 'create_issue',
      server: 'linear',
    });

    expect(recorder.records.stored.size).toBe(0);
    expect(recorder.deletions.locks).toEqual(['ws_1 team_1 task_1']);
  });

  it('ignores an act that names no run when the task has no ended run', async () => {
    const recorder = await acting();

    await recorder.acted('accepted', 11);

    expect(recorder.records.stored.size).toBe(0);
  });

  it('ignores an act it does not know', async () => {
    const recorder = await acting(['run_1', 9]);

    await recorder.acted('danced', 10);

    expect(await recorder.next('run_1')).toBeNull();
  });
});

describe('recording how a run’s change was checked', () => {
  it('fills in the verdict on a recorded run', async () => {
    const records = new RunRecordsInMemory();
    await records.add(endedRecord('run_1'));

    await new RecordChangeChecks(records, deletionsInMemory(), inTransaction, {
      now: () => RECEIVED_AT,
      sleep: async () => {},
    }).checked(RunId.of('run_1'), WORKSPACE, null, false);

    expect((await records.of(RunId.of('run_1')))?.checks).toBe('failed');
  });

  it('keeps a verdict received before the end of the run', async () => {
    const records = new RunRecordsInMemory();

    await new RecordChangeChecks(records, deletionsInMemory(), inTransaction, {
      now: () => RECEIVED_AT,
      sleep: async () => {},
    }).checked(RunId.of('run_1'), WORKSPACE, TaskId.of('task_1'), null);

    const record = await records.of(RunId.of('run_1'));
    expect(record?.checks).toBe('skipped');
    expect(record?.hasEnded).toBe(false);
    expect(record?.taskId?.value).toBe('task_1');
  });
});

describe('recording how a run used its tools', () => {
  const usage = (runId: string) => ({
    runId,
    workspaceId: 'ws_1',
    taskId: 'task_1',
    ms: 1_000,
    steps: 3,
    errors: 0,
    changedLines: 0,
    contextTokens: null,
    contextWindow: null,
    cost: null,
    currency: null,
    inputTokens: null,
    outputTokens: null,
    cacheReadTokens: null,
    cacheWriteTokens: null,
    servers: [],
    skillsRead: ['grafana'],
  });

  it('keeps no tool use of a run of a team that was deleted', async () => {
    const records = new RunRecordsInMemory();
    const deletions = deletionsInMemory();
    await deletions.deleteTeam(WORKSPACE, TeamId.of('team_1'));

    await new RecordRunUsageSummary(
      workOfTeam('team_1'),
      records,
      deletions,
      inTransaction,
    ).usageRecorded(usage('run_7'));

    expect(records.stored.size).toBe(0);
    expect(deletions.locks).toEqual(['ws_1 team_1 task_1']);
  });

  it('keeps the tool use of a run, received before the run ended', async () => {
    const records = new RunRecordsInMemory();

    await new RecordRunUsageSummary(
      workOfTeam('team_1'),
      records,
      deletionsInMemory(),
      inTransaction,
    ).usageRecorded(usage('run_7'));

    expect((await records.of(RunId.of('run_7')))?.tools?.read('grafana')).toBe(
      true,
    );
  });
});
