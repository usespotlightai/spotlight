import { ClearRunVerdictCommand } from '@insights/application/commands/clear-run-verdict.command';
import { ClearRunVerdictHandler } from '@insights/application/commands/handlers/clear-run-verdict.handler';
import { RecordRunVerdictHandler } from '@insights/application/commands/handlers/record-run-verdict.handler';
import { RecordRunVerdictCommand } from '@insights/application/commands/record-run-verdict.command';
import type { PeoplePort } from '@insights/application/ports/people.port';
import type { StationJudge } from '@insights/application/ports/station-judges.port';
import { ReadRunScoresHandler } from '@insights/application/queries/handlers/read-run-scores.handler';
import { ReadRunScoresQuery } from '@insights/application/queries/read-run-scores.query';
import { InsightsAccess } from '@insights/application/services/insights-access.service';
import { RunScoresViews } from '@insights/application/services/run-scores-views.service';
import { StationJudgeReports } from '@insights/application/services/station-judge-reports.service';
import { TeamRunRecords } from '@insights/application/services/team-run-records.service';
import { InvalidRunVerdictError } from '@insights/domain/exceptions/invalid-run-verdict.error';
import { RunTakesNoVerdictError } from '@insights/domain/exceptions/run-takes-no-verdict.error';
import { TeamNotFoundError } from '@insights/domain/exceptions/team-not-found.error';
import { UnknownRunError } from '@insights/domain/exceptions/unknown-run.error';
import { PersonAction } from '@insights/domain/value-objects/person-action.vo';
import { RUBRIC_VERSION } from '@insights/judging.fake-spec';
import {
  endedRecord,
  inTransaction,
  RunRecordsInMemory,
  StationFactsInMemory,
  WORKSPACE,
} from '@insights/runs.fake-spec';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const ENDED_AT = new Date('2026-09-30T10:00:00.000Z');
const MOVED_ON_AT = new Date('2026-09-30T10:01:00.000Z');
const MARKED_AT = new Date('2026-10-02T09:00:00.000Z');

const JUDGE: StationJudge = {
  teamId: TeamId.of('team_1'),
  lineId: LineId.of('line_1'),
  rubricVersion: RUBRIC_VERSION,
  claims: ['It names the files to change.'],
  passThreshold: 1,
  sample: 1,
  minAgreement: 0.5,
};

const PEOPLE: PeoplePort = {
  viewerOf: async (teamId, principal) =>
    teamId.equals(TeamId.of('team_1')) &&
    !principal.userId.equals(UserId.of('user_stranger'))
      ? { workspaceId: WORKSPACE, by: principal.userId }
      : null,
  namesOf: async (userIds) =>
    new Map(
      userIds.flatMap((each) =>
        each === 'user_ada' ? [[each, 'Ada Lovelace'] as const] : [],
      ),
    ),
};

const marking = async () => {
  const records = new RunRecordsInMemory();
  await records.add(
    endedRecord('run_1', { endedAt: ENDED_AT }).recordAction(
      PersonAction.of('started', MOVED_ON_AT, UserId.of('user_lin')),
    ),
  );
  await records.add(endedRecord('run_cancelled', { ending: 'cancelled' }));
  const access = new InsightsAccess(PEOPLE);
  const onTeam = new TeamRunRecords(access, records);
  const clock = { now: () => MARKED_AT, sleep: async () => {} };
  const facts = new StationFactsInMemory(records);
  const reading = new ReadRunScoresHandler(
    access,
    new RunScoresViews(
      facts,
      new StationJudgeReports(
        {
          judgesOnTeam: async () => new Map(),
          judgeAt: async () => JUDGE,
        },
        facts,
      ),
      PEOPLE,
    ),
  );
  const recording = new RecordRunVerdictHandler(
    onTeam,
    records,
    inTransaction,
    clock,
  );
  const clearing = new ClearRunVerdictHandler(onTeam, records, inTransaction);

  return {
    records,
    mark: (
      right: boolean,
      reason: string | null = null,
      viewer = 'user_ada',
      runId = 'run_1',
      teamId = 'team_1',
    ) =>
      recording.execute(
        new RecordRunVerdictCommand(teamId, runId, viewer, right, reason),
      ),
    clear: (viewer = 'user_ada') =>
      clearing.execute(new ClearRunVerdictCommand('team_1', 'run_1', viewer)),
    read: () =>
      reading.execute(new ReadRunScoresQuery('team_1', 'run_1', 'user_ada')),
  };
};

describe('RecordRunVerdictHandler', () => {
  it('records a person’s verdict on a run whose task moved on, in place of what people’s actions say', async () => {
    const line = await marking();

    expect(await line.read()).toMatchObject({
      labelFrom: null,
      peoplePass: null,
      personVerdict: null,
      implicitFrom: null,
      takesVerdict: true,
    });

    await line.mark(false, 'It planned the change, which is Spec’s job.');

    expect(await line.read()).toMatchObject({
      labelFrom: 'marked-wrong',
      peoplePass: false,
      personVerdict: {
        right: false,
        reason: 'It planned the change, which is Spec’s job.',
        by: 'user_ada',
        byName: 'Ada Lovelace',
        at: MARKED_AT.toISOString(),
      },
      implicitFrom: null,
    });
  });

  it('leaves what people did with the run as it was', async () => {
    const line = await marking();

    await line.mark(false);

    const record = await line.records.of(RunId.of('run_1'));
    expect(record?.actions.decidingAction?.kind).toBe('started');
    expect(record?.passed).toBeNull();
  });

  it('changes the verdict, and lets anyone on the team clear it', async () => {
    const line = await marking();

    await line.mark(false, 'Wrong station.');
    await line.mark(true, null, 'user_lin');

    expect(await line.read()).toMatchObject({
      labelFrom: 'marked-right',
      peoplePass: true,
      personVerdict: { right: true, reason: null, by: 'user_lin' },
    });

    await line.clear();

    expect(await line.read()).toMatchObject({
      labelFrom: null,
      personVerdict: null,
    });
  });

  it('refuses a reason for a run that was right, a run that never ran, and a run on another team', async () => {
    const line = await marking();
    const refusal = (name: string, kind: string) => ({
      kind,
      refusal: { name },
    });

    await expect(line.mark(true, 'Fine')).rejects.toMatchObject(
      refusal(InvalidRunVerdictError.name, 'invalid'),
    );
    await expect(
      line.mark(false, null, 'user_ada', 'run_cancelled'),
    ).rejects.toMatchObject(refusal(RunTakesNoVerdictError.name, 'conflict'));
    await expect(
      line.mark(false, null, 'user_ada', 'run_unknown'),
    ).rejects.toMatchObject(refusal(UnknownRunError.name, 'not-found'));
    await expect(line.mark(false, null, 'user_stranger')).rejects.toMatchObject(
      refusal(TeamNotFoundError.name, 'not-found'),
    );
    await expect(
      line.mark(false, null, 'user_ada', 'run_1', 'team_2'),
    ).rejects.toMatchObject({ kind: 'not-found' });
  });
});
