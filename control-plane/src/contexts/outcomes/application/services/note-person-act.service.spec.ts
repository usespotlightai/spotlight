import { forgottenInMemory } from '@outcomes/application/ports/forgotten.fake-spec';
import type { EndedRun, WorkPort } from '@outcomes/application/ports/work.port';
import { NoteChangeChecked } from '@outcomes/application/services/note-change-checked.service';
import { NotePersonAct } from '@outcomes/application/services/note-person-act.service';
import { NoteRunDigested } from '@outcomes/application/services/note-run-digested.service';
import {
  endedRecord,
  inTransaction,
  RunRecordsInMemory,
  WORKSPACE,
} from '@outcomes/domain/outcomes.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const HEARD_AT = new Date('2026-09-30T12:00:00.000Z');

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
  const forgotten = forgottenInMemory();

  for (const [runId, hour, change] of runs) {
    await records.add(endedRecord(runId, { endedAt: at(hour), ...change }));
  }

  const service = new NotePersonAct(
    workOfTeam('team_1'),
    records,
    forgotten,
    inTransaction,
  );

  return {
    records,
    forgotten,
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
        act,
        after,
        at: at(hour).toISOString(),
        tool: tool?.tool ?? null,
        server: tool?.server ?? null,
        forApproval: tool !== null,
      }),
    refusals: async (runId: string) =>
      (await records.of(RunId.of(runId)))?.refusals.map((each) => ({
        tool: each.tool,
        server: each.server,
      })) ?? [],
    next: async (runId: string) =>
      (await records.of(RunId.of(runId)))?.next?.act ?? null,
  };
};

describe('noting what a person did after a run', () => {
  it('notes the tool a person refused on the run that asked, once however often it is heard', async () => {
    const noted = await acting(['run_1', 9]);
    const tool = { tool: 'mcp__linear__create_issue', server: 'linear' };

    await noted.acted('refused', 10, 'run_1', tool);
    await noted.acted('refused', 10, 'run_1', tool);

    expect(await noted.refusals('run_1')).toEqual([tool]);
  });

  it('notes no refusal for an approval or for a refusal that names no tool', async () => {
    const noted = await acting(['run_1', 9]);

    await noted.acted('approved', 10, 'run_1', {
      tool: 'mcp__linear__create_issue',
      server: 'linear',
    });
    await noted.acted('refused', 11, 'run_1');

    expect(await noted.refusals('run_1')).toEqual([]);
  });

  it('gives the act to the run it names', async () => {
    const noted = await acting(['run_1', 9], ['run_2', 10]);

    await noted.acted('sent-back', 11, 'run_1');

    expect(await noted.next('run_1')).toBe('sent-back');
    expect(await noted.next('run_2')).toBeNull();
  });

  it('gives an act that names no run to the task’s latest run that ended before it', async () => {
    const noted = await acting(['run_1', 9], ['run_2', 10], ['run_3', 12]);

    await noted.acted('approved', 11);

    expect(await noted.next('run_2')).toBe('approved');
    expect(await noted.next('run_1')).toBeNull();
    expect(await noted.next('run_3')).toBeNull();
  });

  it('gives an act that names no run to the latest run at the station the task was acted on at', async () => {
    const noted = await acting(
      ['run_1', 9],
      ['run_2', 10, { stationId: 'station_2' }],
    );

    await noted.acted('parked', 11);

    expect(await noted.next('run_1')).toBe('parked');
    expect(await noted.next('run_2')).toBeNull();
  });

  it('gives no act to a run withdrawn before it ran', async () => {
    const noted = await acting(
      ['run_1', 9],
      ['run_2', 10, { ending: 'withdrawn' }],
    );

    await noted.acted('closed', 11);

    expect(await noted.next('run_1')).toBe('closed');
    expect(await noted.next('run_2')).toBeNull();
  });

  it('counts only the first act after a run', async () => {
    const noted = await acting(['run_1', 9]);

    await noted.acted('sent-back', 10);
    await noted.acted('closed', 11);

    expect(await noted.next('run_1')).toBe('sent-back');
  });

  it('does not hand a later act to an earlier run already acted on', async () => {
    const noted = await acting(['run_1', 9], ['run_2', 10]);
    await noted.acted('sent-back', 11, 'run_2');

    await noted.acted('closed', 12);

    expect(await noted.next('run_1')).toBeNull();
    expect(await noted.next('run_2')).toBe('sent-back');
  });

  it('keeps an act that names a run heard of before the run ended', async () => {
    const noted = await acting();

    await noted.acted('answered', 11, 'run_7');

    expect(await noted.next('run_7')).toBe('answered');
    expect((await noted.records.of(RunId.of('run_7')))?.taskId?.value).toBe(
      'task_1',
    );
  });

  it('keeps no act on a run of a team that was forgotten', async () => {
    const noted = await acting();
    await noted.forgotten.forgetTeam(WORKSPACE, TeamId.of('team_1'));

    await noted.acted('refused', 11, 'run_7', {
      tool: 'create_issue',
      server: 'linear',
    });

    expect(noted.records.held.size).toBe(0);
    expect(noted.forgotten.holds).toEqual(['ws_1 team_1 task_1']);
  });

  it('ignores an act that names no run when the task has no ended run', async () => {
    const noted = await acting();

    await noted.acted('closed', 11);

    expect(noted.records.held.size).toBe(0);
  });

  it('ignores an act it does not know', async () => {
    const noted = await acting(['run_1', 9]);

    await noted.acted('danced', 10);

    expect(await noted.next('run_1')).toBeNull();
  });
});

describe('noting how a run’s change was checked', () => {
  it('fills in the verdict on a recorded run', async () => {
    const records = new RunRecordsInMemory();
    await records.add(endedRecord('run_1'));

    await new NoteChangeChecked(records, forgottenInMemory(), inTransaction, {
      now: () => HEARD_AT,
      sleep: async () => {},
    }).checked(RunId.of('run_1'), WORKSPACE, null, false);

    expect((await records.of(RunId.of('run_1')))?.checks).toBe('failed');
  });

  it('keeps a verdict heard before the run was heard to end', async () => {
    const records = new RunRecordsInMemory();

    await new NoteChangeChecked(records, forgottenInMemory(), inTransaction, {
      now: () => HEARD_AT,
      sleep: async () => {},
    }).checked(RunId.of('run_1'), WORKSPACE, TaskId.of('task_1'), null);

    const record = await records.of(RunId.of('run_1'));
    expect(record?.checks).toBe('skipped');
    expect(record?.hasEnded).toBe(false);
    expect(record?.taskId?.value).toBe('task_1');
  });
});

describe('noting how a run used its tools', () => {
  const digest = (runId: string) => ({
    runId,
    workspaceId: 'ws_1',
    taskId: 'task_1',
    ms: 1_000,
    steps: 3,
    faults: 0,
    changedLines: 0,
    used: null,
    size: null,
    cost: null,
    currency: null,
    inputTokens: null,
    outputTokens: null,
    cacheReadTokens: null,
    cacheWriteTokens: null,
    servers: [],
    skillsRead: ['grafana'],
  });

  it('keeps no tool use of a run of a team that was forgotten', async () => {
    const records = new RunRecordsInMemory();
    const forgotten = forgottenInMemory();
    await forgotten.forgetTeam(WORKSPACE, TeamId.of('team_1'));

    await new NoteRunDigested(
      workOfTeam('team_1'),
      records,
      forgotten,
      inTransaction,
    ).digested(digest('run_7'));

    expect(records.held.size).toBe(0);
    expect(forgotten.holds).toEqual(['ws_1 team_1 task_1']);
  });

  it('keeps the tool use of a run heard before it ended', async () => {
    const records = new RunRecordsInMemory();

    await new NoteRunDigested(
      workOfTeam('team_1'),
      records,
      forgottenInMemory(),
      inTransaction,
    ).digested(digest('run_7'));

    expect((await records.of(RunId.of('run_7')))?.tools?.read('grafana')).toBe(
      true,
    );
  });
});
