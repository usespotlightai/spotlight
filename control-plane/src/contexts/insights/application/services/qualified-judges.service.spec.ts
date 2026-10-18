import type { JudgeCalibrationShape } from '@insights/application/ports/judge-calibration.port';
import { QualifiedJudges } from '@insights/application/services/qualified-judges.service';
import { TeamAccess } from '@insights/domain/services/team-access';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const ACCESS = TeamAccess.onTeam('team_1', {
  workspaceId: WorkspaceId.of('workspace_1'),
  by: UserId.of('user_ada'),
});

const shapeOf = (
  stationId: string,
  over: Partial<JudgeCalibrationShape>,
): JudgeCalibrationShape => ({
  stationId,
  rubricVersion: null,
  qualified: false,
  measure: null,
  agreement: null,
  pairs: 0,
  minAgreement: null,
  hiddenReason: 'no-judge',
  ...over,
});

describe('QualifiedJudges', () => {
  it('gives each station its own calibration, whatever order the calibrations come in', async () => {
    const requested: unknown[] = [];
    const judges = new QualifiedJudges({
      calibrationsOf: async (team, stations) => {
        requested.push({ team, stations });

        return [
          shapeOf('station_c', {}),
          shapeOf('station_b', {
            rubricVersion: 'b'.repeat(64),
            measure: 'spearman',
            agreement: 0.3,
            pairs: 9,
            minAgreement: 0.6,
            hiddenReason: 'below-min-agreement',
          }),
          shapeOf('station_a', {
            rubricVersion: 'a'.repeat(64),
            qualified: true,
            measure: 'kappa',
            agreement: 0.8,
            pairs: 20,
            minAgreement: 0.5,
            hiddenReason: null,
          }),
        ];
      },
    });

    const calibrations = await judges.calibrations(ACCESS, [
      { lineId: 'line_1', stationId: 'station_a' },
      { lineId: 'line_1', stationId: 'station_b' },
      { lineId: 'line_2', stationId: 'station_c' },
    ]);

    expect(requested).toEqual([
      {
        team: { workspaceId: 'workspace_1', teamId: 'team_1' },
        stations: [
          { lineId: 'line_1', stationId: 'station_a' },
          { lineId: 'line_1', stationId: 'station_b' },
          { lineId: 'line_2', stationId: 'station_c' },
        ],
      },
    ]);
    expect(calibrations.judges).toEqual([
      {
        lineId: 'line_1',
        stationId: 'station_a',
        rubricVersion: 'a'.repeat(64),
        qualified: true,
        measure: 'kappa',
        agreement: 0.8,
        pairs: 20,
        minAgreement: 0.5,
        hiddenReason: null,
      },
      {
        lineId: 'line_1',
        stationId: 'station_b',
        rubricVersion: 'b'.repeat(64),
        qualified: false,
        measure: 'spearman',
        agreement: 0.3,
        pairs: 9,
        minAgreement: 0.6,
        hiddenReason: 'below-min-agreement',
      },
    ]);
    expect(calibrations.qualified).toEqual(
      new Map([['station_a', 'a'.repeat(64)]]),
    );
  });
});
