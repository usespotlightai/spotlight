import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { selectForBriefing } from '@memory/domain/services/briefing-selection';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import {
  type MemoryPlace,
  MemoryScope,
} from '@memory/domain/value-objects/memory-scope.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');
const API = Repository.of('acme/api');
const WEB = Repository.of('acme/web');

let made = 0;

const kept = (
  scope: {
    lineId?: string;
    stationId?: string;
    repository?: Repository;
    paths?: string[];
    teamId?: TeamId;
  },
  body = 'Remember this.',
  at = new Date('2026-09-20T10:00:00.000Z'),
) => {
  made += 1;
  return Memory.written({
    id: MemoryId.of(`memory_${made}`),
    handle: MemoryHandle.of(made),
    workspaceId: WorkspaceId.of('ws_1'),
    kind: 'preference',
    body,
    scope: MemoryScope.of({
      teamId: scope.teamId ?? TEAM,
      lineId: scope.lineId ?? null,
      stationId: scope.stationId ?? null,
      repository: scope.repository ?? null,
      paths: (scope.paths ?? []).map(MemoryPath.of),
    }),
    grounds: null,
    supersedes: null,
    by: MemoryDecision.of({ by: UserId.of('user_1'), at }),
  });
};

const PLACE: MemoryPlace = {
  teamId: TEAM,
  lineId: 'line_delivery',
  stationId: 'station_build',
  repositories: [API],
  touched: [{ repository: API, path: MemoryPath.of('src/uploads/retry.ts') }],
};

const bodies = (memories: readonly Memory[]) =>
  memories.map((each) => each.body);

describe('selecting what to brief a run with', () => {
  it('gives the memories whose scope reaches the run, and no others', () => {
    const chosen = selectForBriefing(
      [
        kept({}, 'Team-wide.'),
        kept({ lineId: 'line_delivery' }, 'This line.'),
        kept({ lineId: 'line_docs' }, 'Another line.'),
        kept(
          { lineId: 'line_delivery', stationId: 'station_review' },
          'Another station.',
        ),
        kept({ repository: WEB }, 'Another repository.'),
        kept({ teamId: TeamId.of('team_2') }, 'Another team.'),
        kept(
          { repository: API, paths: ['src/uploads'] },
          'A folder the run touches.',
        ),
        kept(
          { repository: API, paths: ['src/billing.ts'] },
          'A file it does not.',
        ),
      ],
      PLACE,
    );

    expect(bodies(chosen.briefed).sort()).toEqual(
      ['A folder the run touches.', 'Team-wide.', 'This line.'].sort(),
    );
  });

  it('never gives a line’s memory to a chat, which works at no line', () => {
    const chosen = selectForBriefing(
      [kept({}, 'Team-wide.'), kept({ lineId: 'line_delivery' }, 'This line.')],
      { ...PLACE, lineId: null, stationId: null, touched: [] },
    );

    expect(bodies(chosen.briefed)).toEqual(['Team-wide.']);
  });

  it('ranks the most specific first, then the most recent', () => {
    const chosen = selectForBriefing(
      [
        kept({}, 'Team, older.', new Date('2026-09-01T00:00:00.000Z')),
        kept({}, 'Team, newer.', new Date('2026-09-10T00:00:00.000Z')),
        kept({ lineId: 'line_delivery' }, 'Line.'),
        kept(
          { lineId: 'line_delivery', stationId: 'station_build' },
          'Station.',
        ),
        kept({ repository: API, paths: ['src'] }, 'Paths.'),
      ],
      PLACE,
    );

    expect(bodies(chosen.briefed)).toEqual([
      'Paths.',
      'Station.',
      'Line.',
      'Team, newer.',
      'Team, older.',
    ]);
  });

  it('holds to its cap on how many and how long', () => {
    const many = Array.from({ length: 30 }, (_, at) =>
      kept({}, `Memory ${at}.`),
    );
    const long = Array.from({ length: 6 }, (_, at) =>
      kept({}, `${at}`.padEnd(900, '.')),
    );

    expect(selectForBriefing(many, PLACE).briefed).toHaveLength(12);
    expect(selectForBriefing(long, PLACE).briefed).toHaveLength(4);
  });

  it('keeps what the cap cut, the nearest to making it first, and never what did not reach the run', () => {
    const many = Array.from({ length: 40 }, (_, at) =>
      kept({}, `Memory ${at}.`, new Date(Date.UTC(2026, 8, 1, 0, 0, 40 - at))),
    );
    const elsewhere = kept({ lineId: 'line_docs' }, 'Another line.');

    const chosen = selectForBriefing([...many, elsewhere], PLACE);

    expect(bodies(chosen.cut)).toEqual(
      Array.from({ length: 20 }, (_, at) => `Memory ${at + 12}.`),
    );
    expect(bodies(chosen.cut)).not.toContain('Another line.');
    expect(bodies(selectForBriefing(many.slice(0, 3), PLACE).cut)).toEqual([]);
  });

  it('never gives a retired memory', () => {
    const retired = kept({}, 'Retired.').retired({
      by: UserId.of('user_1'),
      reason: 'Wrong.',
      at: new Date('2026-09-21T10:00:00.000Z'),
    });

    expect(selectForBriefing([retired], PLACE)).toEqual({
      briefed: [],
      cut: [],
    });
  });
});
