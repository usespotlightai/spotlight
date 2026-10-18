import { MemoryDraft } from '@memory/domain/aggregates/memory-draft.aggregate';
import {
  MemoryProposal,
  type ProposedMemory,
} from '@memory/domain/entities/memory-proposal.entity';
import { MemoriesProposed } from '@memory/domain/events/memories-proposed.event';
import { MemoryApproved } from '@memory/domain/events/memory-approved.event';
import { MemoryDraftingFailed } from '@memory/domain/events/memory-drafting-failed.event';
import { MemoryDraftingRequested } from '@memory/domain/events/memory-drafting-requested.event';
import { MemoryReviewResolved } from '@memory/domain/events/memory-review-resolved.event';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { MemoryAlreadyDecidedError } from '@memory/domain/exceptions/memory-already-decided.error';
import { UnknownMemoryError } from '@memory/domain/exceptions/unknown-memory.error';
import { DraftEvidence } from '@memory/domain/services/draft-evidence';
import { Remembering } from '@memory/domain/services/remembering';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryDraftId } from '@memory/domain/value-objects/memory-draft-id.vo';
import { MemoryDraftingFailure } from '@memory/domain/value-objects/memory-drafting-failure.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryProvenance } from '@memory/domain/value-objects/memory-provenance.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { MAX_JOB_ATTEMPTS } from '@shared-kernel/domain/value-objects/pending-job.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
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
    runContext: {
      teamId: TEAM,
      lineId: 'line_1',
      stationId: 'station_1',
      repositories: [API],
    },
    steps: [2, 5].map((index) => ({
      index,
      kind: 'message',
      text: 'Wrote it.',
    })),
    notes: notes.map((each) => ({ ...each, text: 'Wrote so.' })),
    notesRead: 0,
    changed: [{ repository: API, path: 'src/uploads.ts' }],
    known: [],
    fromOutside: false,
  });

const remembered = (change: Partial<ProposedMemory> = {}): ProposedMemory => ({
  kind: 'rejected-approach',
  body: 'Retrying uploads from a queue needs a worker the service does not run.',
  scope: 'station',
  repository: 'acme/api',
  paths: ['src/uploads.ts'],
  steps: [5],
  notes: [],
  supersedes: null,
  ...change,
});

const created = () =>
  MemoryDraft.create({
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
  draft.recordDraft({
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
    body: MemoryBody.of('Name branches after the ticket.'),
    scope: MemoryScope.of({ teamId: TEAM }),
    provenance: MemoryProvenance.of({
      taskId: TASK,
      runId: FIRST,
      steps: [],
      notes: [1],
    }),
    source: 'person',
    proposedBy: 'drafter',
    supersedes: null,
    recordedAt: NOW,
    state: 'rejected',
    decision: MemoryDecision.of({ by: UserId.of('user_ada'), at: NOW }),
  });

describe('MemoryDraft', () => {
  describe('a drafting request', () => {
    it('has a pending job to draft the run that ended', () => {
      const requested = created().requestDrafting(FIRST, NOW);

      expect(requested.hasPendingJob).toBe(true);
      expect(requested.drafting?.isFor(FIRST)).toBe(true);
      expect(requested.pullEvents()).toEqual([
        new MemoryDraftingRequested(requested.id, TASK, FIRST),
      ]);
    });

    it('is requested once for a run, however often its ending arrives', () => {
      const requested = created().requestDrafting(FIRST, NOW);
      requested.pullEvents();

      expect(requested.requestDrafting(FIRST, LATER)).toBe(requested);
    });

    it('drafts the latest run when a later one ends before the earlier is drafted', () => {
      const requested = created()
        .requestDrafting(FIRST, NOW)
        .requestDrafting(SECOND, LATER);

      expect(requested.drafting?.isFor(SECOND)).toBe(true);
    });

    it('is not requested again for a run it already drafted', () => {
      const drafted = drafting(
        created().requestDrafting(FIRST, NOW),
        FIRST,
        [],
      );

      expect(drafted.requestDrafting(FIRST, LATER).hasPendingJob).toBe(false);
    });
  });

  describe('drafting', () => {
    it('proposes what the evidence supports and drops what it does not', () => {
      const drafted = drafting(created().requestDrafting(FIRST, NOW), FIRST, [
        remembered(),
        remembered({ steps: [9] }),
        remembered({ paths: ['src/elsewhere.ts'] }),
        remembered({ kind: 'gossip' }),
      ]);

      expect(drafted.hasPendingJob).toBe(false);
      expect(drafted.draftedIn?.equals(FIRST)).toBe(true);
      expect(drafted.proposals).toHaveLength(1);
      expect(drafted.proposals[0]?.proposed).toBe(true);
      expect(drafted.pullEvents().slice(-1)[0]).toEqual(
        new MemoriesProposed(drafted.id, TASK, FIRST, 1, 3, 0),
      );
    });

    it('replaces the proposals an earlier run left and keeps the rejected ones', () => {
      const first = drafting(created().requestDrafting(FIRST, NOW), FIRST, [
        remembered(),
        remembered({ body: 'The staging bucket rejects uploads over 5 GB.' }),
      ]);
      const existing = MemoryDraft.rehydrate({
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

      const second = drafting(existing.requestDrafting(SECOND, LATER), SECOND, [
        remembered({ kind: 'environment', body: 'CI has no network.' }),
      ]);

      expect(second.proposals.map((each) => each.body.value)).toEqual([
        'Name branches after the ticket.',
        'CI has no network.',
      ]);
      expect(second.pullEvents().slice(-1)[0]).toEqual(
        new MemoriesProposed(second.id, TASK, SECOND, 1, 0, 2),
      );
    });

    it('keeps the proposals still waiting for a person when a later run brought nothing to read', () => {
      const first = drafting(created().requestDrafting(FIRST, NOW), FIRST, [
        remembered(),
      ]);

      const quiet = first.requestDrafting(SECOND, LATER).recordDraft({
        runId: SECOND,
        proposed: [],
        evidence: DraftEvidence.of({
          taskId: TASK,
          runId: SECOND,
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
          known: [],
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

    it('does not draft from the evidence of another task or run', () => {
      const requested = created().requestDrafting(FIRST, NOW);

      expect(() =>
        requested.recordDraft({
          runId: FIRST,
          proposed: [remembered()],
          evidence: evidence(SECOND),
          newId,
          now: NOW,
        }),
      ).toThrow(InvalidMemoryError);
    });

    it('ignores a draft of a run that it no longer waits for', () => {
      const requested = created().requestDrafting(SECOND, NOW);

      expect(drafting(requested, FIRST, [remembered()])).toBe(requested);
    });

    it('reads a note once, unless a proposal still waiting for a person cites it', () => {
      const drafted = drafting(
        created().requestDrafting(FIRST, NOW),
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
      const drafted = drafting(
        created().requestDrafting(FIRST, NOW),
        FIRST,
        [],
        [],
      );

      expect(drafted.notesRead).toBe(0);
    });
  });

  describe('failing', () => {
    it('is retried later where the failure allows another attempt', () => {
      const leased = created().requestDrafting(FIRST, NOW).leaseJob(NOW);

      const failed = leased.failed(
        MemoryDraftingFailure.of('request-failed', NOW),
      );

      expect(failed.hasPendingJob).toBe(true);
      expect(failed.drafting?.job.nextAttemptAt?.getTime()).toBe(
        NOW.getTime() + 30_000,
      );
      expect(failed.pullEvents()).not.toContainEqual(
        expect.any(MemoryDraftingFailed),
      );
    });

    it('keeps nothing and says why when the failure allows no other attempt', () => {
      const leased = created().requestDrafting(FIRST, NOW).leaseJob(NOW);
      const failure = MemoryDraftingFailure.of('no-evidence', NOW);

      const failed = leased.failed(failure);

      expect(failed.hasPendingJob).toBe(false);
      expect(failed.proposals).toEqual([]);
      expect(failed.failure?.code).toBe('no-evidence');
      expect(failed.pullEvents().slice(-1)[0]).toEqual(
        new MemoryDraftingFailed(failed.id, TASK, FIRST, failure),
      );
    });

    it('ends with the failure once it has used every attempt the failure allows', () => {
      let draft = created().requestDrafting(FIRST, NOW);
      let at = NOW;

      for (let attempt = 1; attempt < 3; attempt += 1) {
        draft = draft
          .leaseJob(at)
          .failed(MemoryDraftingFailure.of('unreadable', at));
        at = draft.drafting?.job.nextAttemptAt ?? at;
      }

      const failed = draft
        .leaseJob(at)
        .failed(MemoryDraftingFailure.of('unreadable', at));

      expect(failed.hasPendingJob).toBe(false);
      expect(failed.failure?.code).toBe('unreadable');
    });

    it('is dead-lettered as interrupted when its leases keep running out', () => {
      let draft = created().requestDrafting(FIRST, NOW);
      let at = NOW;

      for (let attempt = 0; attempt < MAX_JOB_ATTEMPTS; attempt += 1) {
        draft = draft.leaseJob(at);
        at = draft.drafting?.job.nextAttemptAt ?? at;
      }

      expect(draft.jobExhausted).toBe(true);
      expect(draft.deadLetter(LATER).failure?.code).toBe('interrupted');
    });

    it('clears a failure once a later draft succeeds', () => {
      const failed = created()
        .requestDrafting(FIRST, NOW)
        .leaseJob(NOW)
        .failed(MemoryDraftingFailure.of('no-evidence', NOW));

      const drafted = drafting(
        failed.requestDrafting(SECOND, LATER),
        SECOND,
        [],
      );

      expect(drafted.failure).toBeNull();
    });

    it('cannot be leased before it is due', () => {
      const waiting = created()
        .requestDrafting(FIRST, NOW)
        .leaseJob(NOW)
        .failed(MemoryDraftingFailure.of('request-failed', NOW));

      expect(() => waiting.leaseJob(NOW)).toThrow(InvalidMemoryError);
    });
  });

  describe('deciding', () => {
    const ADA = MemoryDecision.of({ by: UserId.of('user_ada'), at: LATER });

    const three = () => {
      const draft = drafting(created().requestDrafting(FIRST, NOW), FIRST, [
        remembered({ body: 'First.' }),
        remembered({ body: 'Second.' }),
        remembered({ body: 'Third.' }),
      ]);
      draft.pullEvents();
      return draft;
    };

    const outside = () => {
      const draft = created()
        .requestDrafting(FIRST, NOW)
        .recordDraft({
          runId: FIRST,
          proposed: [
            remembered({ body: 'From outside.' }),
            remembered({ body: 'Also from outside.' }),
          ],
          evidence: DraftEvidence.of({
            taskId: TASK,
            runId: FIRST,
            runContext: {
              teamId: TEAM,
              lineId: 'line_1',
              stationId: 'station_1',
              repositories: [API],
            },
            steps: [{ index: 5, kind: 'message', text: 'Wrote it.' }],
            notes: [],
            notesRead: 0,
            changed: [{ repository: API, path: 'src/uploads.ts' }],
            known: [],
            fromOutside: true,
          }),
          newId,
          now: NOW,
        });
      draft.pullEvents();
      return draft;
    };

    const idOf = (draft: MemoryDraft, at: number) => {
      const proposal = draft.proposals[at];
      if (!proposal) throw new Error('no proposal there');
      return proposal.id;
    };

    it('approves a memory, recording who approved it and when', () => {
      const draft = three();

      const approved = draft.approve({
        runId: FIRST,
        approving: [{ id: idOf(draft, 0) }],
        decision: ADA,
      });

      const [first] = approved.proposals;
      expect(first?.state).toBe('approved');
      expect(first?.decision?.equals(ADA)).toBe(true);
      expect(approved.pullEvents()).toEqual([
        expect.objectContaining({
          constructor: MemoryApproved,
          memoryId: first?.id,
          body: MemoryBody.of('First.'),
          decision: ADA,
        }),
      ]);
    });

    it('approves an edited memory with its new body and its original provenance', () => {
      const draft = three();
      const before = draft.proposals[0];

      const approved = draft.approve({
        runId: FIRST,
        approving: [{ id: idOf(draft, 0), body: '  Edited.  ' }],
        decision: ADA,
      });

      expect(approved.proposals[0]?.body.value).toBe('Edited.');
      expect(
        before && approved.proposals[0]?.provenance.equals(before.provenance),
      ).toBe(true);
    });

    it('approves several memories at once', () => {
      const draft = three();

      const approved = draft.approve({
        runId: FIRST,
        approving: [{ id: idOf(draft, 0) }, { id: idOf(draft, 1) }],
        decision: ADA,
      });

      expect(approved.proposals.map((each) => each.state)).toEqual([
        'approved',
        'approved',
        'proposed',
      ]);
    });

    it('approves a memory from outside the team only on its own', () => {
      const draft = outside();

      expect(() =>
        draft.approve({
          runId: FIRST,
          approving: [{ id: idOf(draft, 0) }, { id: idOf(draft, 1) }],
          decision: ADA,
        }),
      ).toThrow(InvalidMemoryError);
      expect(
        draft.approve({
          runId: FIRST,
          approving: [{ id: idOf(draft, 0) }],
          decision: ADA,
        }).proposals[0]?.state,
      ).toBe('approved');
    });

    it('rejects a memory and stores it, announcing no approval', () => {
      const draft = three();

      const rejected = draft.reject({
        runId: FIRST,
        id: idOf(draft, 2),
        decision: ADA,
      });

      expect(rejected.proposals[2]?.state).toBe('rejected');
      expect(rejected.proposals).toHaveLength(3);
      expect(rejected.pullEvents()).toEqual([]);
    });

    it('decides a memory only once', () => {
      const draft = three();
      const rejected = draft.reject({
        runId: FIRST,
        id: idOf(draft, 0),
        decision: ADA,
      });

      expect(() =>
        rejected.approve({
          runId: FIRST,
          approving: [{ id: idOf(draft, 0) }],
          decision: ADA,
        }),
      ).toThrow(MemoryAlreadyDecidedError);
    });

    it('rejects a memory of another run than the one under review', () => {
      const draft = three();

      expect(() =>
        draft.reject({ runId: SECOND, id: idOf(draft, 0), decision: ADA }),
      ).toThrow(UnknownMemoryError);
    });

    it('rejects a memory it does not contain, or one named twice', () => {
      const draft = three();

      expect(() =>
        draft.reject({
          runId: FIRST,
          id: MemoryId.of('memory_elsewhere'),
          decision: ADA,
        }),
      ).toThrow(UnknownMemoryError);
      expect(() =>
        draft.approve({
          runId: FIRST,
          approving: [{ id: idOf(draft, 0) }, { id: idOf(draft, 0) }],
          decision: ADA,
        }),
      ).toThrow(InvalidMemoryError);
    });

    it('resolves a run’s review once nothing it proposed is left to decide', () => {
      let draft = three();

      draft = draft.approve({
        runId: FIRST,
        approving: [{ id: idOf(draft, 0) }, { id: idOf(draft, 1) }],
        decision: ADA,
      });
      expect(draft.pullEvents()).not.toContainEqual(
        expect.any(MemoryReviewResolved),
      );

      draft = draft.reject({
        runId: FIRST,
        id: idOf(draft, 2),
        decision: ADA,
      });
      expect(draft.pullEvents()).toEqual([
        new MemoryReviewResolved(draft.id, TASK, FIRST),
      ]);
    });

    it('resolves an earlier run’s review when a later run replaces what it left undecided', () => {
      const draft = three();

      const later = drafting(draft.requestDrafting(SECOND, LATER), SECOND, [
        remembered({ body: 'Later.' }),
      ]);

      expect(later.pullEvents()).toEqual(
        expect.arrayContaining([
          new MemoryReviewResolved(later.id, TASK, FIRST),
          new MemoriesProposed(later.id, TASK, SECOND, 1, 0, 3),
        ]),
      );
    });

    it('keeps approved and rejected memories when a later run replaces the rest', () => {
      const draft = three();
      const decided = draft
        .approve({
          runId: FIRST,
          approving: [{ id: idOf(draft, 0) }],
          decision: ADA,
        })
        .reject({ runId: FIRST, id: idOf(draft, 1), decision: ADA });

      const later = drafting(
        decided.requestDrafting(SECOND, LATER),
        SECOND,
        [],
      );

      expect(later.proposals.map((each) => each.state)).toEqual([
        'approved',
        'rejected',
      ]);
    });
  });

  describe('remembering', () => {
    const proposedByRun = (
      runId: RunId,
      body = 'Uploads retry in the request, not from a queue.',
      id = 'memory_remembered',
    ) =>
      Remembering.of({
        taskId: TASK,
        runId,
        replay: false,
        isSearch: false,
      }).proposalOf({
        id: MemoryId.of(id),
        remembered: {
          kind: 'rationale',
          body,
          scope: null,
          paths: [],
          supersedes: null,
        },
        at: {
          runContext: {
            teamId: TEAM,
            lineId: 'line_1',
            stationId: 'station_1',
            repositories: [API],
          },
          steps: [{ index: 3, kind: 'remember' }],
          cited: [],
          fromOutside: false,
        },
        now: NOW,
      });

    it('takes in what a run proposed to remember and puts it to a person', () => {
      const draft = created().remember(proposedByRun(FIRST));

      expect(draft.proposals.map((each) => each.id.value)).toEqual([
        'memory_remembered',
      ]);
      expect(draft.stepsRemembered(FIRST)).toEqual([3]);
      expect(draft.pullEvents()).toEqual([
        new MemoriesProposed(draft.id, TASK, FIRST, 1, 0, 0),
      ]);
    });

    it('takes in the same memory from the same run only once', () => {
      const draft = created().remember(proposedByRun(FIRST));
      draft.pullEvents();
      const again = proposedByRun(FIRST, undefined, 'memory_again');

      expect(draft.remember(again)).toBe(draft);
      expect(draft.findProposal(again)?.id.value).toBe('memory_remembered');
    });

    it('rejects a drafted proposal, or one of another task', () => {
      const [drafted] = drafting(created().requestDrafting(FIRST, NOW), FIRST, [
        remembered(),
      ]).proposals;
      if (!drafted) {
        throw new Error('nothing was drafted');
      }

      expect(() => created().remember(drafted)).toThrow(InvalidMemoryError);
      expect(() =>
        MemoryDraft.create({
          id: MemoryDraftId.of('draft_2'),
          taskId: TaskId.of('task_other'),
          workspaceId: WorkspaceId.of('ws_1'),
        }).remember(proposedByRun(FIRST)),
      ).toThrow(InvalidMemoryError);
    });

    it('drafts nothing the run already proposed to remember in the same words', () => {
      const draft = created()
        .remember(proposedByRun(FIRST, remembered().body))
        .requestDrafting(FIRST, NOW);
      draft.pullEvents();

      const drafted = drafting(draft, FIRST, [
        remembered({ kind: 'rationale' }),
      ]);

      expect(drafted.proposals.map((each) => each.proposedBy)).toEqual([
        'agent',
      ]);
    });

    it('keeps what a run remembered when a later draft replaces the rest', () => {
      const draft = drafting(
        created().remember(proposedByRun(FIRST)).requestDrafting(FIRST, NOW),
        FIRST,
        [remembered()],
      ).requestDrafting(SECOND, LATER);
      draft.pullEvents();

      const redrafted = drafting(draft, SECOND, [remembered()]);

      expect(
        redrafted.proposals
          .filter((each) => each.proposed)
          .map((each) => [each.proposedBy, each.provenance.runId.value]),
      ).toEqual([
        ['agent', 'run_1'],
        ['drafter', 'run_2'],
      ]);
      expect(
        redrafted
          .pullEvents()
          .some((event) => event instanceof MemoryReviewResolved),
      ).toBe(false);
    });
  });

  describe('rehydrating', () => {
    it('rejects a proposal that cites another task', () => {
      const other = MemoryProposal.of({
        id: MemoryId.of('memory_other'),
        kind: 'preference',
        body: MemoryBody.of('Name branches after the ticket.'),
        scope: MemoryScope.of({ teamId: TEAM }),
        provenance: MemoryProvenance.of({
          taskId: TaskId.of('task_other'),
          runId: FIRST,
          steps: [1],
          notes: [],
        }),
        source: 'run',
        proposedBy: 'drafter',
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
