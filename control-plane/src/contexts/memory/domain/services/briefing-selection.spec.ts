import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { selectForBriefing } from '@memory/domain/services/briefing-selection';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { MemoryKind } from '@memory/domain/value-objects/memory-kind';
import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import type { TouchedSite } from '@memory/domain/value-objects/run-site';
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
  kind: MemoryKind = 'preference',
) => {
  made += 1;
  return Memory.written({
    id: MemoryId.of(`memory_${made}`),
    handle: MemoryHandle.of(made),
    workspaceId: WorkspaceId.of('ws_1'),
    kind,
    body: MemoryBody.of(body),
    scope: MemoryScope.of({
      teamId: scope.teamId ?? TEAM,
      lineId: scope.lineId ?? null,
      stationId: scope.stationId ?? null,
      repository: scope.repository ?? null,
      paths: (scope.paths ?? []).map(MemoryPath.of),
    }),
    grounds: null,
    by: MemoryDecision.of({ by: UserId.of('user_1'), at }),
  });
};

const OLDER = new Date('2026-09-01T10:00:00.000Z');

const PLACE: TouchedSite = {
  teamId: TEAM,
  lineId: 'line_delivery',
  stationId: 'station_build',
  repositories: [API],
  touched: [{ repository: API, path: MemoryPath.of('src/uploads/retry.ts') }],
};

const choosing = (
  memories: readonly Memory[],
  site: TouchedSite,
  ranks: Record<string, number> = {},
  recalled: Record<string, number> = {},
) =>
  selectForBriefing(
    memories.map((memory) => ({
      memory,
      rank: ranks[memory.body.value] ?? 0,
      recalled: recalled[memory.body.value] ?? 0,
    })),
    site,
  );

const bodies = (memories: readonly Memory[]) =>
  memories.map((each) => each.body.value);

describe('selecting what to brief a run with', () => {
  it('gives the memories whose scope reaches the run, and no others', () => {
    const chosen = choosing(
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
    const chosen = choosing(
      [kept({}, 'Team-wide.'), kept({ lineId: 'line_delivery' }, 'This line.')],
      { ...PLACE, lineId: null, stationId: null, touched: [] },
    );

    expect(bodies(chosen.briefed)).toEqual(['Team-wide.']);
  });

  it('ranks the most specific first, then the most recent', () => {
    const chosen = choosing(
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

    expect(choosing(many, PLACE).briefed).toHaveLength(8);
    expect(choosing(long, PLACE).briefed).toHaveLength(3);
  });

  it('keeps what the cap cut, the nearest to making it first, and never what did not reach the run', () => {
    const many = Array.from({ length: 40 }, (_, at) =>
      kept({}, `Memory ${at}.`, new Date(Date.UTC(2026, 8, 1, 0, 0, 40 - at))),
    );
    const elsewhere = kept({ lineId: 'line_docs' }, 'Another line.');

    const chosen = choosing([...many, elsewhere], PLACE);

    expect(bodies(chosen.cut)).toEqual(
      Array.from({ length: 20 }, (_, at) => `Memory ${at + 8}.`),
    );
    expect(bodies(chosen.cut)).not.toContain('Another line.');
    expect(bodies(choosing(many.slice(0, 3), PLACE).cut)).toEqual([]);
  });

  it('never gives a retired memory', () => {
    const retired = kept({}, 'Retired.').retired({
      by: UserId.of('user_1'),
      reason: 'Wrong.',
      at: new Date('2026-09-21T10:00:00.000Z'),
    });

    expect(choosing([retired], PLACE)).toEqual({
      briefed: [],
      cut: [],
    });
  });

  it('ranks a memory whose words match the task above an equally scoped one that does not', () => {
    const chosen = choosing(
      [
        kept({}, 'Name branches after the ticket.'),
        kept({}, 'Uploads retry in the request.'),
      ],
      PLACE,
      { 'Uploads retry in the request.': 0.03 },
    );

    expect(bodies(chosen.briefed)).toEqual([
      'Uploads retry in the request.',
      'Name branches after the ticket.',
    ]);
  });

  it('lets the task’s words lift a memory past a more specific one', () => {
    const chosen = choosing(
      [
        kept({ lineId: 'line_delivery' }, 'This line names branches.'),
        kept({}, 'Uploads retry in the request.'),
      ],
      PLACE,
      { 'Uploads retry in the request.': 0.1 },
    );

    expect(bodies(chosen.briefed)[0]).toBe('Uploads retry in the request.');
  });

  it('counts any rank past a strong match as a full match', () => {
    const chosen = choosing(
      [
        kept({}, 'Ranked far past strong.', OLDER),
        kept({}, 'Ranked just strong.'),
      ],
      PLACE,
      { 'Ranked far past strong.': 0.9, 'Ranked just strong.': 0.1 },
    );

    expect(bodies(chosen.briefed)).toEqual([
      'Ranked just strong.',
      'Ranked far past strong.',
    ]);
  });

  it('reaches a memory about paths the task has not touched only when its words match', () => {
    const elsewhere = { ...PLACE, touched: [] };
    const aboutUploads = kept(
      { repository: API, paths: ['src/uploads'] },
      'Uploads retry in the request.',
    );

    expect(bodies(choosing([aboutUploads], elsewhere).briefed)).toEqual([]);
    expect(
      bodies(
        choosing([aboutUploads], elsewhere, {
          'Uploads retry in the request.': 0.01,
        }).briefed,
      ),
    ).toEqual(['Uploads retry in the request.']);
  });

  it('never briefs a memory beside the correction replacing it', () => {
    const old = kept({}, 'Name branches after people.');
    const correction = old.correctedAs({
      id: MemoryId.of('memory_correction'),
      handle: MemoryHandle.of(900),
      kind: old.kind,
      body: MemoryBody.of('Name branches after the ticket.'),
      scope: old.scope,
      by: MemoryDecision.of({
        by: UserId.of('user_1'),
        at: new Date('2026-09-21T10:00:00.000Z'),
      }),
    });

    const chosen = choosing([old, correction], PLACE);

    expect(bodies(chosen.briefed)).toEqual(['Name branches after the ticket.']);
    expect(bodies(chosen.cut)).toEqual([]);
  });

  it('puts warnings ahead of preferences at the same specificity', () => {
    const chosen = choosing(
      [
        kept({}, 'Name branches after the ticket.'),
        kept({}, 'The worker test hangs without Redis.', undefined, 'failure'),
      ],
      PLACE,
    );

    expect(bodies(chosen.briefed)[0]).toBe(
      'The worker test hangs without Redis.',
    );
  });

  it('nudges up what earlier runs recalled', () => {
    const chosen = choosing(
      [kept({}, 'Newer.'), kept({}, 'Recalled before.', OLDER)],
      PLACE,
      {},
      { 'Recalled before.': 2 },
    );

    expect(bodies(chosen.briefed)[0]).toBe('Recalled before.');
  });

  it('never lets a weak match on a memory about untouched paths outrank a station’s warning', () => {
    const chosen = choosing(
      [
        kept(
          { repository: API, paths: ['src/uploads'] },
          'Fix retries by draining the queue.',
        ),
        kept(
          { lineId: 'line_delivery', stationId: 'station_build' },
          'The build needs Redis.',
          undefined,
          'failure',
        ),
      ],
      { ...PLACE, touched: [] },
      { 'Fix retries by draining the queue.': 0.04 },
    );

    expect(bodies(chosen.briefed)).toEqual([
      'The build needs Redis.',
      'Fix retries by draining the queue.',
    ]);
  });
});
