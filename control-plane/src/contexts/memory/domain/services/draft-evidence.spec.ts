import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { ProposedMemory } from '@memory/domain/entities/memory-proposal.entity';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { DraftEvidence } from '@memory/domain/services/draft-evidence';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-27T10:00:00.000Z');
const API = Repository.of('acme/api');
const WEB = Repository.of('acme/web');
const TEAM = TeamId.of('team_1');

let handles = 0;
const approved = (id: string, scope: MemoryScope, at = NOW) => {
  handles += 1;
  return Memory.write({
    id: MemoryId.of(id),
    handle: MemoryHandle.of(handles),
    workspaceId: WorkspaceId.of('ws_1'),
    kind: 'preference',
    body: MemoryBody.of('Retry twice.'),
    scope,
    provenance: null,
    by: MemoryDecision.of({ by: UserId.of('user_1'), at }),
  });
};

const KNOWN = [
  approved('memory_old', MemoryScope.of({ teamId: TEAM, lineId: 'line_1' })),
  approved(
    'memory_other_station',
    MemoryScope.of({ teamId: TEAM, lineId: 'line_1', stationId: 'station_9' }),
  ),
  approved('memory_retired', MemoryScope.of({ teamId: TEAM })).retire({
    by: UserId.of('user_1'),
    reason: 'Gone.',
    at: NOW,
  }),
];

const evidence = (fromOutside = false) =>
  DraftEvidence.of({
    taskId: TaskId.of('task_1'),
    runId: RunId.of('run_1'),
    runContext: {
      teamId: TEAM,
      lineId: 'line_1',
      stationId: 'station_1',
      repositories: [API, WEB],
    },
    steps: [
      { index: 2, kind: 'thought', text: 'A queue needs a worker.' },
      { index: 5, kind: 'message', text: 'Retrying in the request.' },
    ],
    notes: [
      { position: 3, by: 'person', text: 'Use the archive bucket.' },
      { position: 6, by: 'world', text: 'Never retry on a 403.' },
    ],
    notesRead: 0,
    changed: [
      { repository: API, path: 'src/uploads.ts' },
      { repository: WEB, path: 'src/Upload.tsx' },
    ],
    known: KNOWN,
    fromOutside,
  });

const remembered = (change: Partial<ProposedMemory> = {}): ProposedMemory => ({
  kind: 'correction',
  body: 'Uploads go to the archive bucket, not the staging one.',
  scope: 'team',
  repository: null,
  paths: [],
  steps: [5],
  notes: [],
  supersedes: null,
  ...change,
});

const proposalOf = (proposed: ProposedMemory, fromOutside = false) =>
  evidence(fromOutside).proposalOf(MemoryId.of('memory_1'), proposed, NOW);

describe('DraftEvidence', () => {
  describe('the provenance a proposal cites', () => {
    it('accepts steps of the run and notes the drafter read', () => {
      const proposal = proposalOf(remembered({ steps: [5, 2], notes: [3] }));

      expect(proposal.provenance.steps).toEqual([2, 5]);
      expect(proposal.provenance.notes).toEqual([3]);
      expect(proposal.provenance.runId.value).toBe('run_1');
      expect(proposal.provenance.taskId.value).toBe('task_1');
    });

    it('rejects a step the run does not have', () => {
      expect(() => proposalOf(remembered({ steps: [7] }))).toThrow(
        InvalidMemoryError,
      );
    });

    it('rejects a note the drafter did not read', () => {
      expect(() => proposalOf(remembered({ steps: [], notes: [1] }))).toThrow(
        InvalidMemoryError,
      );
    });

    it('rejects a memory that cites nothing', () => {
      expect(() => proposalOf(remembered({ steps: [], notes: [] }))).toThrow(
        InvalidMemoryError,
      );
    });
  });

  describe('where a proposal applies', () => {
    it('keeps a team-wide memory to the team alone', () => {
      const { scope } = proposalOf(remembered({ scope: 'team' }));

      expect(scope.teamId.value).toBe('team_1');
      expect(scope.lineId).toBeNull();
      expect(scope.stationId).toBeNull();
    });

    it('keeps a line’s memory to the run’s line', () => {
      const { scope } = proposalOf(remembered({ scope: 'line' }));

      expect(scope.lineId).toBe('line_1');
      expect(scope.stationId).toBeNull();
    });

    it('keeps a station’s memory to the run’s line and station', () => {
      const { scope } = proposalOf(remembered({ scope: 'station' }));

      expect([scope.lineId, scope.stationId]).toEqual(['line_1', 'station_1']);
    });

    it('rejects a scope it does not know', () => {
      expect(() => proposalOf(remembered({ scope: 'everyone' }))).toThrow(
        InvalidMemoryError,
      );
    });

    it('is about paths the run changed in the repository it names', () => {
      const { scope } = proposalOf(
        remembered({ repository: 'acme/api', paths: ['/src/uploads.ts'] }),
      );

      expect(scope.repository?.value).toBe('acme/api');
      expect(scope.paths.map((each) => each.value)).toEqual(['src/uploads.ts']);
    });

    it('rejects a path the run did not change, or changed in another repository', () => {
      expect(() =>
        proposalOf(
          remembered({ repository: 'acme/api', paths: ['README.md'] }),
        ),
      ).toThrow(InvalidMemoryError);
      expect(() =>
        proposalOf(
          remembered({ repository: 'acme/api', paths: ['src/Upload.tsx'] }),
        ),
      ).toThrow(InvalidMemoryError);
    });

    it('rejects paths without the repository they lie in', () => {
      expect(() =>
        proposalOf(remembered({ paths: ['src/uploads.ts'] })),
      ).toThrow(InvalidMemoryError);
    });

    it('rejects a repository the run did not work in', () => {
      expect(() =>
        proposalOf(remembered({ repository: 'acme/infra' })),
      ).toThrow(InvalidMemoryError);
    });

    it('rejects a repository named in a shape no repository has', () => {
      expect(() => proposalOf(remembered({ repository: 'api' }))).toThrow(
        InvalidMemoryError,
      );
      expect(() =>
        proposalOf(remembered({ repository: 'acme/api/src' })),
      ).toThrow(InvalidMemoryError);
    });

    it('rejects a path that climbs out of its repository', () => {
      expect(() =>
        proposalOf(
          remembered({ repository: 'acme/api', paths: ['../secrets.env'] }),
        ),
      ).toThrow(InvalidMemoryError);
    });
  });

  describe('where a proposal came from', () => {
    it('comes from a person when it cites only notes by a person', () => {
      expect(proposalOf(remembered({ steps: [], notes: [3] })).source).toBe(
        'person',
      );
    });

    it('comes from the run when it cites any step of the agent', () => {
      expect(proposalOf(remembered({ steps: [2], notes: [3] })).source).toBe(
        'run',
      );
    });

    it('comes from outside when it cites a reply nobody signed in to give', () => {
      expect(proposalOf(remembered({ steps: [], notes: [6] })).source).toBe(
        'outside',
      );
      expect(proposalOf(remembered({ steps: [2], notes: [3, 6] })).source).toBe(
        'outside',
      );
    });

    it('comes from outside whenever the task did, whatever it cites', () => {
      expect(
        proposalOf(remembered({ steps: [], notes: [3] }), true).source,
      ).toBe('outside');
      expect(proposalOf(remembered({ steps: [2] }), true).source).toBe(
        'outside',
      );
    });
  });

  describe('superseding', () => {
    it('supersedes an active memory in scope', () => {
      expect(
        proposalOf(remembered({ supersedes: 'memory_old' })).supersedes?.value,
      ).toBe('memory_old');
    });

    it('does not supersede a memory it was not shown', () => {
      expect(() =>
        proposalOf(remembered({ supersedes: 'memory_elsewhere' })),
      ).toThrow(InvalidMemoryError);
    });

    it('does not supersede a memory that does not apply where the run worked, or is no longer active', () => {
      for (const supersedes of ['memory_other_station', 'memory_retired']) {
        expect(() => proposalOf(remembered({ supersedes }))).toThrow(
          InvalidMemoryError,
        );
      }
    });

    it('shows the drafter only what is active where the run worked, newest first', () => {
      const newer = approved(
        'memory_newer',
        MemoryScope.of({ teamId: TEAM }),
        new Date('2026-09-28T10:00:00.000Z'),
      );
      const shown = DraftEvidence.of({
        taskId: TaskId.of('task_1'),
        runId: RunId.of('run_1'),
        runContext: {
          teamId: TEAM,
          lineId: 'line_1',
          stationId: 'station_1',
          repositories: [API],
        },
        steps: [],
        notes: [],
        notesRead: 0,
        changed: [],
        known: [...KNOWN, newer],
        fromOutside: false,
      }).active.map((each) => each.id.value);

      expect(shown).toEqual(['memory_newer', 'memory_old']);
    });
  });

  it('says the last note it read', () => {
    expect(evidence().notesThrough).toBe(6);
  });

  describe('limiting the prompt of the drafter to its length', () => {
    const long = (size: number) => 'x'.repeat(size);

    const clippedEvidence = (input: {
      steps?: number;
      notes?: number;
      notesRead?: number;
      changed?: readonly string[];
    }) =>
      DraftEvidence.of({
        taskId: TaskId.of('task_1'),
        runId: RunId.of('run_1'),
        runContext: {
          teamId: TEAM,
          lineId: 'line_1',
          stationId: 'station_1',
          repositories: [API],
        },
        steps: Array.from({ length: input.steps ?? 0 }, (_, index) => ({
          index,
          kind: 'message',
          text: long(5_000),
        })),
        notes: Array.from({ length: input.notes ?? 0 }, (_, position) => ({
          position,
          by: 'person' as const,
          text: long(5_000),
        })),
        notesRead: input.notesRead ?? 0,
        changed: (input.changed ?? []).map((path) => ({
          repository: API,
          path,
        })),
        known: [],
        fromOutside: false,
      });

    it('clips a long step and keeps the latest steps that fit', () => {
      const evidence = clippedEvidence({ steps: 60 });

      expect(evidence.steps[0]?.text.length).toBeLessThan(2_100);
      expect(evidence.steps.slice(-1)[0]?.index).toBe(59);
      expect(evidence.stepsLeftOut).toBe(60 - evidence.steps.length);
      expect(evidence.stepsLeftOut).toBeGreaterThan(0);
    });

    it('keeps the earliest notes that fit, so the rest are read next time', () => {
      const evidence = clippedEvidence({ notes: 20 });

      expect(evidence.notes[0]?.position).toBe(0);
      expect(evidence.notes.length).toBeLessThan(20);
      expect(evidence.notesThrough).toBe(evidence.notes.length - 1);
    });

    it('tells notes nobody has read before those it reads again, so new notes are never crowded out', () => {
      const evidence = clippedEvidence({ notes: 30, notesRead: 25 });

      const positions = evidence.notes.map((each) => each.position);

      expect(positions).toEqual(expect.arrayContaining([25, 26, 27, 28, 29]));
      expect(positions.filter((each) => each < 25).length).toBeLessThan(25);
      expect(evidence.notesThrough).toBe(29);
    });

    it('does not cite a step or note left out for length', () => {
      const evidence = clippedEvidence({ steps: 60, notes: 20 });

      expect(() =>
        evidence.proposalOf(
          MemoryId.of('memory_1'),
          remembered({ steps: [0] }),
          NOW,
        ),
      ).toThrow(InvalidMemoryError);
      expect(() =>
        evidence.proposalOf(
          MemoryId.of('memory_1'),
          remembered({ steps: [], notes: [19] }),
          NOW,
        ),
      ).toThrow(InvalidMemoryError);
    });

    it('leaves out a changed file whose path no memory could cover', () => {
      const evidence = clippedEvidence({
        steps: 1,
        notesRead: 0,
        changed: ['src/uploads.ts', long(600)],
      });

      expect(evidence.changed.map((each) => each.path)).toEqual([
        'src/uploads.ts',
      ]);
    });

    it('is empty when the run has no steps and nobody wrote a note', () => {
      expect(clippedEvidence({}).isEmpty).toBe(true);
      expect(clippedEvidence({ steps: 1 }).isEmpty).toBe(false);
    });
  });
});
