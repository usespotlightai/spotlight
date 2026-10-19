import { deletionsInMemory } from '@insights/application/ports/deletions.fake-spec';
import type { JudgePort } from '@insights/application/ports/judge.port';
import type { EndedRun } from '@insights/application/ports/work.port';
import { RequestJudging } from '@insights/application/services/request-judging.service';
import {
  JudgingsInMemory,
  RUBRIC_VERSION,
} from '@insights/domain/judging.fake-spec';
import {
  FIRST_CONFIG,
  inTransaction,
  SET_UP,
} from '@insights/domain/runs.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const ENDED: EndedRun = {
  runId: 'run_1',
  workspaceId: 'ws_1',
  teamId: 'team_1',
  lineId: 'line_1',
  stationId: 'station_1',
  taskId: 'task_1',
  fingerprint: FIRST_CONFIG,
  visit: 1,
  ...SET_UP,
  endedAt: new Date('2026-09-30T10:00:00.000Z'),
};

const requesting = (
  change: {
    sample?: number;
    rubric?: string;
    judged?: boolean;
    available?: boolean;
    hasEvidence?: boolean;
  } = {},
) => {
  const judgings = new JudgingsInMemory();
  const deletions = deletionsInMemory();
  const judge: JudgePort = {
    available: change.available ?? true,
    model: 'some/model',
    judge: async () => ({
      verdict: { value: true, reasons: [] },
      guidance: null,
      usage: null,
    }),
  };
  const service = new RequestJudging(
    {
      endedRun: async () => ENDED,
      configsInOrder: async () => [],
      teamRepositories: async () => [],
      teamSkillKeys: async () => [],
      alertsAt: async () => null,
    },
    {
      hasTask: async () => change.hasEvidence ?? true,
      of: async () => null,
      judgesOnTeam: async () => new Map(),
      judgeAt: async () =>
        change.judged === false
          ? null
          : {
              teamId: 'team_1',
              lineId: 'line_1',
              rubric: change.rubric ?? 'Did the run retry uploads?',
              rubricVersion: RUBRIC_VERSION,
              claims: [],
              passThreshold: 1,
              sample: change.sample ?? 1,
              minAgreement: 0.6,
            },
    },
    judge,
    judgings,
    deletions,
    inTransaction,
    { now: () => new Date('2026-09-30T10:05:00.000Z'), sleep: async () => {} },
  );

  return {
    judgings,
    deletions,
    ended: (outcome = 'completed', stopped = false) =>
      service.runEnded({ runId: 'run_1', outcome, stopped, failure: null }),
  };
};

describe('RequestJudging', () => {
  it('requests no verdict on a run whose end is received after its task was deleted', async () => {
    const requested = requesting();
    await requested.deletions.deleteTask(
      WorkspaceId.of('ws_1'),
      TaskId.of('task_1'),
    );

    await requested.ended();

    expect(requested.judgings.stored.size).toBe(0);
  });

  it('requests no verdict on a run whose end is received after its workspace was deleted', async () => {
    const requested = requesting();
    await requested.deletions.deleteWorkspace(WorkspaceId.of('ws_1'));

    await requested.ended();

    expect(requested.judgings.stored.size).toBe(0);
  });

  it('requests a verdict on a sampled run of a judged station, with its rubric', async () => {
    const requested = requesting();

    await requested.ended();

    const judging = await requested.judgings.of(RunId.of('run_1'));
    expect(judging?.rubric.text).toBe('Did the run retry uploads?');
    expect(judging?.location.stationId).toBe('station_1');
    expect(judging?.fingerprint).toBe(FIRST_CONFIG);
  });

  it('requests once, however often the run’s end is received', async () => {
    const requested = requesting();

    await requested.ended();
    await requested.ended();

    expect(requested.judgings.stored.size).toBe(1);
  });

  it.each([
    ['no model to judge with', { available: false }],
    ['a station without a judge', { judged: false }],
    ['a rubric whose scale is unknown', { rubric: 'scores: stars\nWell?' }],
    ['a run left out of the sample', { sample: 0 }],
    [
      'a run whose task was deleted before its end was received',
      { hasEvidence: false },
    ],
  ])('requests nothing for %s', async (_, change) => {
    const requested = requesting(change);

    await requested.ended();

    expect(requested.judgings.stored.size).toBe(0);
  });

  it.each(['failed', 'exhausted', 'cancelled'])(
    'requests nothing for a run that %s',
    async (outcome) => {
      const requested = requesting();

      await requested.ended(outcome);

      expect(requested.judgings.stored.size).toBe(0);
    },
  );

  it('requests a verdict on a run a person stopped', async () => {
    const requested = requesting();

    await requested.ended('completed', true);

    expect(requested.judgings.stored.size).toBe(1);
  });
});
