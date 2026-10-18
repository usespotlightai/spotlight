import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { selectForBriefing } from '@memory/domain/services/briefing-selection';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { MemoryKind } from '@memory/domain/value-objects/memory-kind';
import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import type { TouchedContext } from '@memory/domain/value-objects/run-context';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');
const API = Repository.of('acme/api');
const WEB = Repository.of('acme/web');

let made = 0;

const approved = (
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
  return Memory.write({
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
    provenance: null,
    by: MemoryDecision.of({ by: UserId.of('user_1'), at }),
  });
};

const OLDER = new Date('2026-09-01T10:00:00.000Z');

const TOUCHED_CONTEXT: TouchedContext = {
  teamId: TEAM,
  lineId: 'line_delivery',
  stationId: 'station_build',
  repositories: [API],
  touched: [{ repository: API, path: MemoryPath.of('src/uploads/retry.ts') }],
};

const choosing = (
  memories: readonly Memory[],
  runContext: TouchedContext,
  ranks: Record<string, number> = {},
  recalled: Record<string, number> = {},
) =>
  selectForBriefing(
    memories.map((memory) => ({
      memory,
      rank: ranks[memory.body.value] ?? 0,
      recalled: recalled[memory.body.value] ?? 0,
    })),
    runContext,
  );

const bodies = (memories: readonly Memory[]) =>
  memories.map((each) => each.body.value);

describe('selecting what to brief a run with', () => {
  it('briefs the memories whose scope matches the run, and no others', () => {
    const chosen = choosing(
      [
        approved({}, 'Team-wide.'),
        approved({ lineId: 'line_delivery' }, 'This line.'),
        approved({ lineId: 'line_docs' }, 'Another line.'),
        approved(
          { lineId: 'line_delivery', stationId: 'station_review' },
          'Another station.',
        ),
        approved({ repository: WEB }, 'Another repository.'),
        approved({ teamId: TeamId.of('team_2') }, 'Another team.'),
        approved(
          { repository: API, paths: ['src/uploads'] },
          'A folder the run touches.',
        ),
        approved(
          { repository: API, paths: ['src/billing.ts'] },
          'A file it does not.',
        ),
      ],
      TOUCHED_CONTEXT,
    );

    expect(bodies(chosen.briefed).sort()).toEqual(
      ['A folder the run touches.', 'Team-wide.', 'This line.'].sort(),
    );
  });

  it('never briefs a line’s memory to a chat, which works at no line', () => {
    const chosen = choosing(
      [
        approved({}, 'Team-wide.'),
        approved({ lineId: 'line_delivery' }, 'This line.'),
      ],
      { ...TOUCHED_CONTEXT, lineId: null, stationId: null, touched: [] },
    );

    expect(bodies(chosen.briefed)).toEqual(['Team-wide.']);
  });

  it('ranks the most specific first, then the most recent', () => {
    const chosen = choosing(
      [
        approved({}, 'Team, older.', new Date('2026-09-01T00:00:00.000Z')),
        approved({}, 'Team, newer.', new Date('2026-09-10T00:00:00.000Z')),
        approved({ lineId: 'line_delivery' }, 'Line.'),
        approved(
          { lineId: 'line_delivery', stationId: 'station_build' },
          'Station.',
        ),
        approved({ repository: API, paths: ['src'] }, 'Paths.'),
      ],
      TOUCHED_CONTEXT,
    );

    expect(bodies(chosen.briefed)).toEqual([
      'Paths.',
      'Station.',
      'Line.',
      'Team, newer.',
      'Team, older.',
    ]);
  });

  it('keeps to its cap on how many and how long', () => {
    const many = Array.from({ length: 30 }, (_, at) =>
      approved({}, `Memory ${at}.`),
    );
    const long = Array.from({ length: 6 }, (_, at) =>
      approved({}, `${at}`.padEnd(900, '.')),
    );

    expect(choosing(many, TOUCHED_CONTEXT).briefed).toHaveLength(8);
    expect(choosing(long, TOUCHED_CONTEXT).briefed).toHaveLength(3);
  });

  it('keeps what the cap omitted, the nearest to making it first, and never what did not match the run', () => {
    const many = Array.from({ length: 40 }, (_, at) =>
      approved(
        {},
        `Memory ${at}.`,
        new Date(Date.UTC(2026, 8, 1, 0, 0, 40 - at)),
      ),
    );
    const elsewhere = approved({ lineId: 'line_docs' }, 'Another line.');

    const chosen = choosing([...many, elsewhere], TOUCHED_CONTEXT);

    expect(bodies(chosen.omitted)).toEqual(
      Array.from({ length: 20 }, (_, at) => `Memory ${at + 8}.`),
    );
    expect(bodies(chosen.omitted)).not.toContain('Another line.');
    expect(bodies(choosing(many.slice(0, 3), TOUCHED_CONTEXT).omitted)).toEqual(
      [],
    );
  });

  it('never briefs a retired memory', () => {
    const retired = approved({}, 'Retired.').retire({
      by: UserId.of('user_1'),
      reason: 'Wrong.',
      at: new Date('2026-09-21T10:00:00.000Z'),
    });

    expect(choosing([retired], TOUCHED_CONTEXT)).toEqual({
      briefed: [],
      omitted: [],
    });
  });

  it('ranks a memory whose words match the task above an equally scoped one that does not', () => {
    const chosen = choosing(
      [
        approved({}, 'Name branches after the ticket.'),
        approved({}, 'Uploads retry in the request.'),
      ],
      TOUCHED_CONTEXT,
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
        approved({ lineId: 'line_delivery' }, 'This line names branches.'),
        approved({}, 'Uploads retry in the request.'),
      ],
      TOUCHED_CONTEXT,
      { 'Uploads retry in the request.': 0.1 },
    );

    expect(bodies(chosen.briefed)[0]).toBe('Uploads retry in the request.');
  });

  it('counts any rank past a strong match as a full match', () => {
    const chosen = choosing(
      [
        approved({}, 'Ranked far past strong.', OLDER),
        approved({}, 'Ranked just strong.'),
      ],
      TOUCHED_CONTEXT,
      { 'Ranked far past strong.': 0.9, 'Ranked just strong.': 0.1 },
    );

    expect(bodies(chosen.briefed)).toEqual([
      'Ranked just strong.',
      'Ranked far past strong.',
    ]);
  });

  it('matches a memory about paths the task has not touched only when its words match', () => {
    const elsewhere = { ...TOUCHED_CONTEXT, touched: [] };
    const aboutUploads = approved(
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
    const old = approved({}, 'Name branches after people.');
    const correction = old.correct({
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

    const chosen = choosing([old, correction], TOUCHED_CONTEXT);

    expect(bodies(chosen.briefed)).toEqual(['Name branches after the ticket.']);
    expect(bodies(chosen.omitted)).toEqual([]);
  });

  it('puts warnings ahead of preferences at the same specificity', () => {
    const chosen = choosing(
      [
        approved({}, 'Name branches after the ticket.'),
        approved(
          {},
          'The worker test hangs without Redis.',
          undefined,
          'failure',
        ),
      ],
      TOUCHED_CONTEXT,
    );

    expect(bodies(chosen.briefed)[0]).toBe(
      'The worker test hangs without Redis.',
    );
  });

  it('nudges up what earlier runs recalled', () => {
    const chosen = choosing(
      [approved({}, 'Newer.'), approved({}, 'Recalled before.', OLDER)],
      TOUCHED_CONTEXT,
      {},
      { 'Recalled before.': 2 },
    );

    expect(bodies(chosen.briefed)[0]).toBe('Recalled before.');
  });

  it('never lets a weak match on a memory about untouched paths outrank a station’s warning', () => {
    const chosen = choosing(
      [
        approved(
          { repository: API, paths: ['src/uploads'] },
          'Fix retries by draining the queue.',
        ),
        approved(
          { lineId: 'line_delivery', stationId: 'station_build' },
          'The build needs Redis.',
          undefined,
          'failure',
        ),
      ],
      { ...TOUCHED_CONTEXT, touched: [] },
      { 'Fix retries by draining the queue.': 0.04 },
    );

    expect(bodies(chosen.briefed)).toEqual([
      'The build needs Redis.',
      'Fix retries by draining the queue.',
    ]);
  });
});
