import { MemoryDraft } from '@memory/domain/aggregates/memory-draft.aggregate';
import {
  MemoryProposal,
  type ProposedMemory,
} from '@memory/domain/entities/memory-proposal.entity';
import { MemoriesProposed } from '@memory/domain/events/memories-proposed.event';
import { MemoryDraftingAsked } from '@memory/domain/events/memory-drafting-asked.event';
import { MemoryDraftingFailed } from '@memory/domain/events/memory-drafting-failed.event';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { DraftEvidence } from '@memory/domain/services/draft-evidence';
import { MemoryDraftId } from '@memory/domain/value-objects/memory-draft-id.vo';
import { MemoryDraftingFailure } from '@memory/domain/value-objects/memory-drafting-failure.vo';
import { MemoryGrounds } from '@memory/domain/value-objects/memory-grounds.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { MOST_WORK_ATTEMPTS } from '@shared-kernel/domain/value-objects/owed-work.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-27T10:00:00.000Z');
const LATER = new Date('2026-09-27T11:00:00.000Z');
const TASK = TaskId.of('task_1');
const FIRST = RunId.of('run_1');
const SECOND = RunId.of('run_2');
const TEAM = TeamId.of('team_1');
const API = Repository.of('acme/api');

const evidence = (
  runId: RunId,
  notes: readonly { position: number; by: 'person' | 'world' }[] = [
    { position: 4, by: 'person' },
  ],
) =>
  DraftEvidence.of({
    taskId: TASK,
    runId,
    place: {
      teamId: TEAM,
      lineId: 'line_1',
      stationId: 'station_1',
      repositories: [API],
    },
    steps: [2, 5].map((index) => ({ index, kind: 'said', text: 'Said it.' })),
    notes: notes.map((each) => ({ ...each, text: 'Said so.' })),
    notesRead: 0,
    changed: [{ repository: API, path: 'src/uploads.ts' }],
    standing: [],
    fromOutside: false,
  });

const remembered = (change: Partial<ProposedMemory> = {}): ProposedMemory => ({
  kind: 'rejected-approach',
  body: 'Retrying uploads from a queue needs a worker the service does not run.',
  reach: 'station',
  repository: 'acme/api',
  paths: ['src/uploads.ts'],
  steps: [5],
  notes: [],
  supersedes: null,
  ...change,
});

const opened = () =>
  MemoryDraft.opened({
    id: MemoryDraftId.of('draft_1'),
    taskId: TASK,
    workspaceId: WorkspaceId.of('ws_1'),
  });

let made = 0;
const newId = () => {
  made += 1;
  return `memory_${made}`;
};

const drafting = (
  draft: MemoryDraft,
  runId: RunId,
  proposed: readonly ProposedMemory[],
  notes?: readonly { position: number; by: 'person' | 'world' }[],
) =>
  draft.drafted({
    runId,
    proposed,
    evidence: evidence(runId, notes),
    newId,
    now: NOW,
  });

const rejected = (id: string) =>
  MemoryProposal.rehydrate({
    id: MemoryId.of(id),
    kind: 'preference',
    body: 'Name branches after the ticket.',
    scope: MemoryScope.of({ teamId: TEAM }),
    grounds: MemoryGrounds.of({
      taskId: TASK,
      runId: FIRST,
      steps: [],
      notes: [1],
    }),
    source: 'person',
    supersedes: null,
    recordedAt: NOW,
    state: 'rejected',
    rejectedAt: NOW,
  });

describe('MemoryDraft', () => {
  describe('being asked to draft', () => {
    it('owes a draft of the run that ended', () => {
      const asked = opened().asked(FIRST, NOW);

      expect(asked.owesWork).toBe(true);
      expect(asked.drafting?.isFor(FIRST)).toBe(true);
      expect(asked.pullEvents()).toEqual([
        new MemoryDraftingAsked(asked.id, TASK, FIRST),
      ]);
    });

    it('is asked once for a run, however often its ending is heard', () => {
      const asked = opened().asked(FIRST, NOW);
      asked.pullEvents();

      expect(asked.asked(FIRST, LATER)).toBe(asked);
    });

    it('drafts the latest run when a later one ends before the earlier is drafted', () => {
      const asked = opened().asked(FIRST, NOW).asked(SECOND, LATER);

      expect(asked.drafting?.isFor(SECOND)).toBe(true);
    });

    it('is not asked again for a run it already drafted', () => {
      const drafted = drafting(opened().asked(FIRST, NOW), FIRST, []);

      expect(drafted.asked(FIRST, LATER).owesWork).toBe(false);
    });
  });

  describe('drafting', () => {
    it('proposes what the evidence grounds and drops what it does not', () => {
      const drafted = drafting(opened().asked(FIRST, NOW), FIRST, [
        remembered(),
        remembered({ steps: [9] }),
        remembered({ paths: ['src/elsewhere.ts'] }),
        remembered({ kind: 'gossip' }),
      ]);

      expect(drafted.owesWork).toBe(false);
      expect(drafted.draftedIn?.equals(FIRST)).toBe(true);
      expect(drafted.proposals).toHaveLength(1);
      expect(drafted.proposals[0]?.proposed).toBe(true);
      expect(drafted.pullEvents().slice(-1)[0]).toEqual(
        new MemoriesProposed(drafted.id, TASK, FIRST, 1, 3, 0),
      );
    });

    it('replaces the proposals an earlier run left and keeps the rejected ones', () => {
      const first = drafting(opened().asked(FIRST, NOW), FIRST, [
        remembered(),
        remembered({ body: 'The staging bucket rejects uploads over 5 GB.' }),
      ]);
      const held = MemoryDraft.rehydrate({
        id: first.id,
        taskId: TASK,
        workspaceId: first.workspaceId,
        drafting: null,
        draftedIn: FIRST,
        notesRead: first.notesRead,
        proposals: [...first.proposals, rejected('memory_rejected')],
        failure: null,
        version: 1,
      });

      const second = drafting(held.asked(SECOND, LATER), SECOND, [
        remembered({ kind: 'environment', body: 'CI has no network.' }),
      ]);

      expect(second.proposals.map((each) => each.body)).toEqual([
        'Name branches after the ticket.',
        'CI has no network.',
      ]);
      expect(second.pullEvents().slice(-1)[0]).toEqual(
        new MemoriesProposed(second.id, TASK, SECOND, 1, 0, 2),
      );
    });

    it('keeps the proposals still waiting for a person when a later run brought nothing to read', () => {
      const first = drafting(opened().asked(FIRST, NOW), FIRST, [remembered()]);

      const quiet = first.asked(SECOND, LATER).drafted({
        runId: SECOND,
        proposed: [],
        evidence: DraftEvidence.of({
          taskId: TASK,
          runId: SECOND,
          place: {
            teamId: TEAM,
            lineId: 'line_1',
            stationId: 'station_1',
            repositories: [API],
          },
          steps: [],
          notes: [],
          notesRead: 0,
          changed: [],
          standing: [],
          fromOutside: false,
        }),
        newId,
        now: LATER,
      });

      expect(quiet.proposals).toEqual(first.proposals);
      expect(quiet.draftedIn?.equals(SECOND)).toBe(true);
      expect(quiet.pullEvents().slice(-1)[0]).toEqual(
        new MemoriesProposed(quiet.id, TASK, SECOND, 0, 0, 0),
      );
    });

    it('refuses to draft from the evidence of another task or run', () => {
      const asked = opened().asked(FIRST, NOW);

      expect(() =>
        asked.drafted({
          runId: FIRST,
          proposed: [remembered()],
          evidence: evidence(SECOND),
          newId,
          now: NOW,
        }),
      ).toThrow(InvalidMemoryError);
    });

    it('ignores a draft of a run it no longer owes', () => {
      const asked = opened().asked(SECOND, NOW);

      expect(drafting(asked, FIRST, [remembered()])).toBe(asked);
    });

    it('reads a note once, unless a proposal still waiting for a person cites it', () => {
      const drafted = drafting(
        opened().asked(FIRST, NOW),
        FIRST,
        [remembered({ steps: [], notes: [4] })],
        [
          { position: 3, by: 'person' },
          { position: 4, by: 'person' },
        ],
      );

      expect(drafted.notesRead).toBe(5);
      expect(drafted.reads(3)).toBe(false);
      expect(drafted.reads(4)).toBe(true);
      expect(drafted.reads(5)).toBe(true);
    });

    it('keeps its place in the notes when a run brought none', () => {
      const drafted = drafting(opened().asked(FIRST, NOW), FIRST, [], []);

      expect(drafted.notesRead).toBe(0);
    });
  });

  describe('failing', () => {
    it('tries again later where the failure allows another attempt', () => {
      const leased = opened().asked(FIRST, NOW).leased(NOW);

      const failed = leased.failed(MemoryDraftingFailure.of('refused', NOW));

      expect(failed.owesWork).toBe(true);
      expect(failed.drafting?.work.dueAt?.getTime()).toBe(
        NOW.getTime() + 30_000,
      );
      expect(failed.pullEvents()).not.toContainEqual(
        expect.any(MemoryDraftingFailed),
      );
    });

    it('keeps nothing and says why when the failure allows no other attempt', () => {
      const leased = opened().asked(FIRST, NOW).leased(NOW);
      const failure = MemoryDraftingFailure.of('no-evidence', NOW);

      const failed = leased.failed(failure);

      expect(failed.owesWork).toBe(false);
      expect(failed.proposals).toEqual([]);
      expect(failed.failure?.code).toBe('no-evidence');
      expect(failed.pullEvents().slice(-1)[0]).toEqual(
        new MemoryDraftingFailed(failed.id, TASK, FIRST, failure),
      );
    });

    it('gives up once a failure has used every attempt it allows', () => {
      let draft = opened().asked(FIRST, NOW);
      let at = NOW;

      for (let attempt = 1; attempt < 3; attempt += 1) {
        draft = draft
          .leased(at)
          .failed(MemoryDraftingFailure.of('unreadable', at));
        at = draft.drafting?.work.dueAt ?? at;
      }

      const failed = draft
        .leased(at)
        .failed(MemoryDraftingFailure.of('unreadable', at));

      expect(failed.owesWork).toBe(false);
      expect(failed.failure?.code).toBe('unreadable');
    });

    it('gives up as interrupted when its leases keep running out', () => {
      let draft = opened().asked(FIRST, NOW);
      let at = NOW;

      for (let attempt = 0; attempt < MOST_WORK_ATTEMPTS; attempt += 1) {
        draft = draft.leased(at);
        at = draft.drafting?.work.dueAt ?? at;
      }

      expect(draft.workExhausted).toBe(true);
      expect(draft.gaveUp(LATER).failure?.code).toBe('interrupted');
    });

    it('clears a failure once a later draft succeeds', () => {
      const failed = opened()
        .asked(FIRST, NOW)
        .leased(NOW)
        .failed(MemoryDraftingFailure.of('no-evidence', NOW));

      const drafted = drafting(failed.asked(SECOND, LATER), SECOND, []);

      expect(drafted.failure).toBeNull();
    });

    it('cannot be leased before it is due', () => {
      const waiting = opened()
        .asked(FIRST, NOW)
        .leased(NOW)
        .failed(MemoryDraftingFailure.of('refused', NOW));

      expect(() => waiting.leased(NOW)).toThrow(InvalidMemoryError);
    });
  });

  describe('rehydrating', () => {
    it('refuses to hold a proposal grounded in another task', () => {
      const other = MemoryProposal.of({
        id: MemoryId.of('memory_other'),
        kind: 'preference',
        body: 'Name branches after the ticket.',
        scope: MemoryScope.of({ teamId: TEAM }),
        grounds: MemoryGrounds.of({
          taskId: TaskId.of('task_other'),
          runId: FIRST,
          steps: [1],
          notes: [],
        }),
        source: 'run',
        supersedes: null,
        recordedAt: NOW,
      });

      expect(() =>
        MemoryDraft.rehydrate({
          id: MemoryDraftId.of('draft_1'),
          taskId: TASK,
          workspaceId: WorkspaceId.of('ws_1'),
          drafting: null,
          draftedIn: FIRST,
          notesRead: 0,
          proposals: [other],
          failure: null,
          version: 1,
        }),
      ).toThrow(InconsistentStateError);
    });
  });
});
