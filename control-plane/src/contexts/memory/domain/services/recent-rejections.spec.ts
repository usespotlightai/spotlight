import { recentRejectionsAt } from '@memory/domain/services/recent-rejections';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');
const RUN_CONTEXT = {
  teamId: TEAM,
  lineId: 'line_1',
  stationId: 'station_1',
  repositories: [],
};

const rejected = (id: string, scope: MemoryScope, day: number) => ({
  id,
  scope,
  decidedAt: new Date(Date.UTC(2026, 8, day)),
});

describe('recent rejections', () => {
  it('keeps only what was turned down where the run works, latest first', () => {
    const recentRejections = recentRejectionsAt(
      [
        rejected('team_wide', MemoryScope.of({ teamId: TEAM }), 1),
        rejected(
          'other_line',
          MemoryScope.of({ teamId: TEAM, lineId: 'line_2' }),
          3,
        ),
        rejected(
          'this_line',
          MemoryScope.of({ teamId: TEAM, lineId: 'line_1' }),
          2,
        ),
      ],
      RUN_CONTEXT,
    );

    expect(recentRejections.map((each) => each.id)).toEqual([
      'this_line',
      'team_wide',
    ]);
  });

  it('keeps at most twenty', () => {
    const many = Array.from({ length: 30 }, (_, day) =>
      rejected(`r_${day}`, MemoryScope.of({ teamId: TEAM }), day + 1),
    );

    expect(recentRejectionsAt(many, RUN_CONTEXT)).toHaveLength(20);
  });
});
