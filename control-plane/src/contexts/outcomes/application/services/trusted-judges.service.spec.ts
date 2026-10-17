import type { JudgeStandingShape } from '@outcomes/application/ports/judge-standing.port';
import { TrustedJudges } from '@outcomes/application/services/trusted-judges.service';
import { TeamAccess } from '@outcomes/domain/services/team-access';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const ACCESS = TeamAccess.onTeam('team_1', {
  workspaceId: WorkspaceId.of('workspace_1'),
  by: UserId.of('user_ada'),
});

const shapeOf = (
  stationId: string,
  over: Partial<JudgeStandingShape>,
): JudgeStandingShape => ({
  stationId,
  rubricVersion: null,
  trusted: false,
  measure: null,
  agreement: null,
  pairs: 0,
  trust: null,
  hiddenBecause: 'no-judge',
  ...over,
});

describe('TrustedJudges', () => {
  it('gives each station its own standing, whatever order the standings come in', async () => {
    const asked: unknown[] = [];
    const judges = new TrustedJudges({
      standingsOf: async (team, stations) => {
        asked.push({ team, stations });

        return [
          shapeOf('station_c', {}),
          shapeOf('station_b', {
            rubricVersion: 'b'.repeat(64),
            measure: 'spearman',
            agreement: 0.3,
            pairs: 9,
            trust: 0.6,
            hiddenBecause: 'below-trust',
          }),
          shapeOf('station_a', {
            rubricVersion: 'a'.repeat(64),
            trusted: true,
            measure: 'kappa',
            agreement: 0.8,
            pairs: 20,
            trust: 0.5,
            hiddenBecause: null,
          }),
        ];
      },
    });

    const standings = await judges.standings(ACCESS, [
      { lineId: 'line_1', stationId: 'station_a' },
      { lineId: 'line_1', stationId: 'station_b' },
      { lineId: 'line_2', stationId: 'station_c' },
    ]);

    expect(asked).toEqual([
      {
        team: { workspaceId: 'workspace_1', teamId: 'team_1' },
        stations: [
          { lineId: 'line_1', stationId: 'station_a' },
          { lineId: 'line_1', stationId: 'station_b' },
          { lineId: 'line_2', stationId: 'station_c' },
        ],
      },
    ]);
    expect(standings.judges).toEqual([
      {
        lineId: 'line_1',
        stationId: 'station_a',
        rubricVersion: 'a'.repeat(64),
        trusted: true,
        measure: 'kappa',
        agreement: 0.8,
        pairs: 20,
        trust: 0.5,
        hiddenBecause: null,
      },
      {
        lineId: 'line_1',
        stationId: 'station_b',
        rubricVersion: 'b'.repeat(64),
        trusted: false,
        measure: 'spearman',
        agreement: 0.3,
        pairs: 9,
        trust: 0.6,
        hiddenBecause: 'below-trust',
      },
    ]);
    expect(standings.trusted).toEqual(new Map([['station_a', 'a'.repeat(64)]]));
  });
});
