import { MemoryDraft } from '@memory/domain/aggregates/memory-draft.aggregate';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import {
  MemoryProposal,
  type ProposedMemory,
} from '@memory/domain/entities/memory-proposal.entity';
import { MemoryApproved } from '@memory/domain/events/memory-approved.event';
import { MemoryReviewReopened } from '@memory/domain/events/memory-review-reopened.event';
import { MemoryReviewRequested } from '@memory/domain/events/memory-review-requested.event';
import { MemoryReviewResolved } from '@memory/domain/events/memory-review-resolved.event';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { MemoryAlreadyDecidedError } from '@memory/domain/exceptions/memory-already-decided.error';
import { MemoryRetirementLapsedError } from '@memory/domain/exceptions/memory-retirement-lapsed.error';
import { UnknownMemoryError } from '@memory/domain/exceptions/unknown-memory.error';
import { DraftEvidence } from '@memory/domain/services/draft-evidence';
import { Remembering } from '@memory/domain/services/remembering';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryDraftId } from '@memory/domain/value-objects/memory-draft-id.vo';
import { MemoryDraftingFailure } from '@memory/domain/value-objects/memory-drafting-failure.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryProvenance } from '@memory/domain/value-objects/memory-provenance.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { AgentTurn } from '@shared-kernel/domain/value-objects/agent-turn.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { MAX_JOB_ATTEMPTS } from '@shared-kernel/domain/value-objects/pending-job.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-27T10:00:00.000Z');

const RUN_ORDERED_AT = new Date('2026-09-01T00:00:00.000Z');
const LATER = new Date('2026-09-27T11:00:00.000Z');
const TASK = TaskId.of('task_1');
const FIRST = RunId.of('run_1');
const SECOND = RunId.of('run_2');
const FIRST_TURN = AgentTurn.of(FIRST, 1, RUN_ORDERED_AT);
const SECOND_TURN = AgentTurn.of(SECOND, 1, RUN_ORDERED_AT);
const TEAM = TeamId.of('team_1');
const API = Repository.of('acme/api');

const evidence = (
  turn: AgentTurn,
  notes: readonly { position: number; by: 'person' | 'world' }[] = [
    { position: 4, by: 'person' },
  ],
) =>
  DraftEvidence.of({
    taskId: TASK,
    turn,
    runContext: {
      teamId: TEAM,
      lineId: LineId.of('line_1'),
      stationId: StationId.of('station_1'),
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
    used: [],
    elsewhere: [],
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
  retires: null,
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
  turn: AgentTurn,
  proposed: readonly ProposedMemory[],
  notes?: readonly { position: number; by: 'person' | 'world' }[],
) =>
  draft.recordDraft({
    turn,
    proposed,
    evidence: evidence(turn, notes),
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
    retires: null,
    recordedAt: NOW,
    state: 'rejected',
    decision: MemoryDecision.of({ by: UserId.of('user_ada'), at: NOW }),
  });

describe('MemoryDraft', () => {
  describe('a drafting request', () => {
    it('has a pending job to draft the run that ended', () => {
      const requested = created().requestDrafting(FIRST_TURN, NOW);

      expect(requested.hasPendingJob).toBe(true);
      expect(requested.drafting?.isFor(FIRST_TURN)).toBe(true);
    });

    it('is requested once for a run, however often its ending arrives', () => {
      const requested = created().requestDrafting(FIRST_TURN, NOW);
      requested.pullEvents();

      expect(requested.requestDrafting(FIRST_TURN, LATER)).toBe(requested);
    });

    it('drafts the latest run when a later one ends before the earlier is drafted', () => {
      const requested = created()
        .requestDrafting(FIRST_TURN, NOW)
        .requestDrafting(SECOND_TURN, LATER);

      expect(requested.drafting?.isFor(SECOND_TURN)).toBe(true);
    });

    it('is not requested again for a run it already drafted', () => {
      const drafted = drafting(
        created().requestDrafting(FIRST_TURN, NOW),
        FIRST_TURN,
        [],
      );

      expect(drafted.requestDrafting(FIRST_TURN, LATER).hasPendingJob).toBe(
        false,
      );
    });
  });

  describe('a drafting request for a kept run', () => {
    const resumed = AgentTurn.of(FIRST, 2, RUN_ORDERED_AT);

    it('drafts again when the same run hands over a later turn', () => {
      const drafted = drafting(
        created().requestDrafting(FIRST_TURN, NOW),
        FIRST_TURN,
        [],
      );
      const requested = drafted.requestDrafting(resumed, LATER);

      expect(requested.hasPendingJob).toBe(true);
      expect(requested.drafting?.isFor(resumed)).toBe(true);
    });

    it('moves a pending request on to the later turn', () => {
      const requested = created()
        .requestDrafting(FIRST_TURN, NOW)
        .requestDrafting(resumed, LATER);

      expect(requested.drafting?.isFor(resumed)).toBe(true);
      expect(requested.drafting?.isFor(FIRST_TURN)).toBe(false);
    });

    it('ignores a turn it already drafted or an older one that arrives late', () => {
      const drafted = drafting(
        created().requestDrafting(resumed, NOW),
        resumed,
        [],
      );

      expect(drafted.requestDrafting(resumed, LATER)).toBe(drafted);
      expect(drafted.requestDrafting(FIRST_TURN, LATER)).toBe(drafted);
    });

    it('ignores an older turn while a later one is pending', () => {
      const requested = created().requestDrafting(resumed, NOW);

      expect(requested.requestDrafting(FIRST_TURN, LATER)).toBe(requested);
    });

    it('records no draft of an earlier turn than the one pending', () => {
      const requested = created()
        .requestDrafting(FIRST_TURN, NOW)
        .requestDrafting(resumed, LATER);

      expect(drafting(requested, FIRST_TURN, [remembered()])).toBe(requested);
    });
  });

  describe('drafting', () => {
    it('proposes what the evidence supports and drops what it does not', () => {
      const drafted = drafting(
        created().requestDrafting(FIRST_TURN, NOW),
        FIRST_TURN,
        [
          remembered(),
          remembered({ steps: [9] }),
          remembered({ paths: ['src/elsewhere.ts'] }),
          remembered({ kind: 'gossip' }),
        ],
      );

      expect(drafted.hasPendingJob).toBe(false);
      expect(drafted.draftedIn?.equals(FIRST_TURN)).toBe(true);
      expect(drafted.proposals).toHaveLength(1);
      expect(drafted.proposals[0]?.proposed).toBe(true);
      expect(drafted.pullEvents().slice(-1)[0]).toEqual(
        new MemoryReviewRequested(drafted.id, TASK, FIRST),
      );
    });

    it('replaces the proposals an earlier run left and keeps the rejected ones', () => {
      const first = drafting(
        created().requestDrafting(FIRST_TURN, NOW),
        FIRST_TURN,
        [
          remembered(),
          remembered({ body: 'The staging bucket rejects uploads over 5 GB.' }),
        ],
      );
      const existing = MemoryDraft.rehydrate({
        id: first.id,
        taskId: TASK,
        workspaceId: first.workspaceId,
        drafting: null,
        draftedIn: FIRST_TURN,
        notesRead: first.notesRead,
        proposals: [...first.proposals, rejected('memory_rejected')],
        failure: null,
        version: 1,
      });

      const second = drafting(
        existing.requestDrafting(SECOND_TURN, LATER),
        SECOND_TURN,
        [remembered({ kind: 'environment', body: 'CI has no network.' })],
      );

      expect(second.proposals.map((each) => each.body.value)).toEqual([
        'Name branches after the ticket.',
        'CI has no network.',
      ]);
      expect(second.pullEvents().slice(-1)[0]).toEqual(
        new MemoryReviewRequested(second.id, TASK, SECOND),
      );
    });

    it('keeps the proposals still waiting for a person when a later run brought nothing to read', () => {
      const first = drafting(
        created().requestDrafting(FIRST_TURN, NOW),
        FIRST_TURN,
        [remembered()],
      );

      const quiet = first.requestDrafting(SECOND_TURN, LATER).recordDraft({
        turn: SECOND_TURN,
        proposed: [],
        evidence: DraftEvidence.of({
          taskId: TASK,
          turn: SECOND_TURN,
          runContext: {
            teamId: TEAM,
            lineId: LineId.of('line_1'),
            stationId: StationId.of('station_1'),
            repositories: [API],
          },
          steps: [],
          notes: [],
          notesRead: 0,
          changed: [],
          known: [],
          used: [],
          elsewhere: [],
          fromOutside: false,
        }),
        newId,
        now: LATER,
      });

      expect(quiet.proposals).toEqual(first.proposals);
      expect(quiet.draftedIn?.equals(SECOND_TURN)).toBe(true);
      expect(quiet.pullEvents()).not.toContainEqual(
        new MemoryReviewRequested(quiet.id, TASK, SECOND),
      );
    });

    it('does not draft from the evidence of another task or run', () => {
      const requested = created().requestDrafting(FIRST_TURN, NOW);

      expect(() =>
        requested.recordDraft({
          turn: FIRST_TURN,
          proposed: [remembered()],
          evidence: evidence(SECOND_TURN),
          newId,
          now: NOW,
        }),
      ).toThrow(InvalidMemoryError);
    });

    it('does not draft a kept turn from the evidence of another attempt of its run', () => {
      const resumed = AgentTurn.of(FIRST, 2, RUN_ORDERED_AT);
      const requested = created().requestDrafting(resumed, NOW);

      expect(() =>
        requested.recordDraft({
          turn: resumed,
          proposed: [remembered()],
          evidence: evidence(FIRST_TURN),
          newId,
          now: NOW,
        }),
      ).toThrow(InvalidMemoryError);
    });

    it('ignores a draft of a run that it no longer waits for', () => {
      const requested = created().requestDrafting(SECOND_TURN, NOW);

      expect(drafting(requested, FIRST_TURN, [remembered()])).toBe(requested);
    });

    it('reads a note once, unless a proposal still waiting for a person cites it', () => {
      const drafted = drafting(
        created().requestDrafting(FIRST_TURN, NOW),
        FIRST_TURN,
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
        created().requestDrafting(FIRST_TURN, NOW),
        FIRST_TURN,
        [],
        [],
      );

      expect(drafted.notesRead).toBe(0);
    });
  });

  describe('failing', () => {
    it('is retried later where the failure allows another attempt', () => {
      const leased = created().requestDrafting(FIRST_TURN, NOW).leaseJob(NOW);

      const failed = leased.failed(
        MemoryDraftingFailure.of('request-failed', NOW),
      );

      expect(failed.hasPendingJob).toBe(true);
      expect(failed.drafting?.job.nextAttemptAt?.getTime()).toBe(
        NOW.getTime() + 30_000,
      );
    });

    it('keeps nothing and says why when the failure allows no other attempt', () => {
      const leased = created().requestDrafting(FIRST_TURN, NOW).leaseJob(NOW);
      const failure = MemoryDraftingFailure.of('no-evidence', NOW);

      const failed = leased.failed(failure);

      expect(failed.hasPendingJob).toBe(false);
      expect(failed.proposals).toEqual([]);
      expect(failed.failure?.code).toBe('no-evidence');
    });

    it('ends with the failure once it has used every attempt the failure allows', () => {
      let draft = created().requestDrafting(FIRST_TURN, NOW);
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
      let draft = created().requestDrafting(FIRST_TURN, NOW);
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
        .requestDrafting(FIRST_TURN, NOW)
        .leaseJob(NOW)
        .failed(MemoryDraftingFailure.of('no-evidence', NOW));

      const drafted = drafting(
        failed.requestDrafting(SECOND_TURN, LATER),
        SECOND_TURN,
        [],
      );

      expect(drafted.failure).toBeNull();
    });

    it('cannot be leased before it is due', () => {
      const waiting = created()
        .requestDrafting(FIRST_TURN, NOW)
        .leaseJob(NOW)
        .failed(MemoryDraftingFailure.of('request-failed', NOW));

      expect(() => waiting.leaseJob(NOW)).toThrow(InvalidMemoryError);
    });
  });

  describe('deciding', () => {
    const ADA = MemoryDecision.of({ by: UserId.of('user_ada'), at: LATER });

    const three = () => {
      const draft = drafting(
        created().requestDrafting(FIRST_TURN, NOW),
        FIRST_TURN,
        [
          remembered({ body: 'First.' }),
          remembered({ body: 'Second.' }),
          remembered({ body: 'Third.' }),
        ],
      );
      draft.pullEvents();
      return draft;
    };

    const outside = () => {
      const draft = created()
        .requestDrafting(FIRST_TURN, NOW)
        .recordDraft({
          turn: FIRST_TURN,
          proposed: [
            remembered({ body: 'From outside.' }),
            remembered({ body: 'Also from outside.' }),
          ],
          evidence: DraftEvidence.of({
            taskId: TASK,
            turn: FIRST_TURN,
            runContext: {
              teamId: TEAM,
              lineId: LineId.of('line_1'),
              stationId: StationId.of('station_1'),
              repositories: [API],
            },
            steps: [{ index: 5, kind: 'message', text: 'Wrote it.' }],
            notes: [],
            notesRead: 0,
            changed: [{ repository: API, path: 'src/uploads.ts' }],
            known: [],
            used: [],
            elsewhere: [],
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
        current: [],
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
        current: [],
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
        current: [],
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
          current: [],
          approving: [{ id: idOf(draft, 0) }, { id: idOf(draft, 1) }],
          decision: ADA,
        }),
      ).toThrow(InvalidMemoryError);
      expect(
        draft.approve({
          runId: FIRST,
          current: [],
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

    it('takes a rejection back, so the memory waits for a decision and its review opens again', () => {
      const draft = three();
      const rejected = draft.reject({
        runId: FIRST,
        id: idOf(draft, 2),
        decision: ADA,
      });
      rejected.pullEvents();

      const restored = rejected.restore({ runId: FIRST, id: idOf(draft, 2) });

      expect(restored.proposals[2]?.state).toBe('proposed');
      expect(restored.proposals[2]?.decision).toBeNull();
      expect(restored.pullEvents()).toEqual([
        new MemoryReviewReopened(draft.id, draft.taskId, FIRST),
      ]);
    });

    it('takes back only a rejection', () => {
      const draft = three();
      const approved = draft.approve({
        runId: FIRST,
        current: [],
        approving: [{ id: idOf(draft, 0) }],
        decision: ADA,
      });

      expect(() => draft.restore({ runId: FIRST, id: idOf(draft, 1) })).toThrow(
        MemoryAlreadyDecidedError,
      );
      expect(() =>
        approved.restore({ runId: FIRST, id: idOf(draft, 0) }),
      ).toThrow(MemoryAlreadyDecidedError);
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
          current: [],
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
          current: [],
          approving: [{ id: idOf(draft, 0) }, { id: idOf(draft, 0) }],
          decision: ADA,
        }),
      ).toThrow(InvalidMemoryError);
    });

    it('resolves a run’s review once nothing it proposed is left to decide', () => {
      let draft = three();

      draft = draft.approve({
        runId: FIRST,
        current: [],
        approving: [{ id: idOf(draft, 0) }, { id: idOf(draft, 1) }],
        decision: ADA,
      });
      expect(draft.pullEvents()).not.toContainEqual(
        expect.any(MemoryReviewResolved),
      );
      expect(draft.awaitsReviewIn(FIRST)).toBe(true);

      draft = draft.reject({
        runId: FIRST,
        id: idOf(draft, 2),
        decision: ADA,
      });
      expect(draft.pullEvents()).toEqual([
        new MemoryReviewResolved(draft.id, TASK, FIRST),
      ]);
      expect(draft.awaitsReviewIn(FIRST)).toBe(false);
    });

    it('resolves an earlier run’s review when a later run replaces what it left undecided', () => {
      const draft = three();

      const later = drafting(
        draft.requestDrafting(SECOND_TURN, LATER),
        SECOND_TURN,
        [remembered({ body: 'Later.' })],
      );

      expect(later.pullEvents()).toEqual(
        expect.arrayContaining([
          new MemoryReviewResolved(later.id, TASK, FIRST),
          new MemoryReviewRequested(later.id, TASK, SECOND),
        ]),
      );
    });

    it('keeps approved and rejected memories when a later run replaces the rest', () => {
      const draft = three();
      const decided = draft
        .approve({
          runId: FIRST,
          current: [],
          approving: [{ id: idOf(draft, 0) }],
          decision: ADA,
        })
        .reject({ runId: FIRST, id: idOf(draft, 1), decision: ADA });

      const later = drafting(
        decided.requestDrafting(SECOND_TURN, LATER),
        SECOND_TURN,
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
        asOf: null,
        isolated: false,
        trial: false,
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
            lineId: LineId.of('line_1'),
            stationId: StationId.of('station_1'),
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
        new MemoryReviewRequested(draft.id, TASK, FIRST),
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
      const [drafted] = drafting(
        created().requestDrafting(FIRST_TURN, NOW),
        FIRST_TURN,
        [remembered()],
      ).proposals;
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
        .requestDrafting(FIRST_TURN, NOW);
      draft.pullEvents();

      const drafted = drafting(draft, FIRST_TURN, [
        remembered({ kind: 'rationale' }),
      ]);

      expect(drafted.proposals.map((each) => each.proposedBy)).toEqual([
        'agent',
      ]);
    });

    it('keeps what a run remembered when a later draft replaces the rest', () => {
      const draft = drafting(
        created()
          .remember(proposedByRun(FIRST))
          .requestDrafting(FIRST_TURN, NOW),
        FIRST_TURN,
        [remembered()],
      ).requestDrafting(SECOND_TURN, LATER);
      draft.pullEvents();

      const redrafted = drafting(draft, SECOND_TURN, [remembered()]);

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
          draftedIn: FIRST_TURN,
          notesRead: 0,
          proposals: [other],
          failure: null,
          version: 1,
        }),
      ).toThrow(InconsistentStateError);
    });
  });
});

describe('approving a retirement', () => {
  const BY = MemoryDecision.of({ by: UserId.of('user_ada'), at: LATER });
  const target = Memory.write({
    id: MemoryId.of('memory_old'),
    handle: MemoryHandle.of(3),
    workspaceId: WorkspaceId.of('ws_1'),
    kind: 'preference',
    body: MemoryBody.of('Name branches after the ticket.'),
    scope: MemoryScope.of({ teamId: TEAM }),
    provenance: null,
    by: MemoryDecision.of({ by: UserId.of('user_ada'), at: NOW }),
  });
  const retiring = MemoryDraft.rehydrate({
    id: MemoryDraftId.of('draft_1'),
    taskId: TASK,
    workspaceId: WorkspaceId.of('ws_1'),
    drafting: null,
    draftedIn: FIRST_TURN,
    notesRead: 0,
    proposals: [
      MemoryProposal.retiring({
        id: MemoryId.of('memory_forget'),
        retired: target,
        reason: 'The team moved to numbered branches.',
        provenance: MemoryProvenance.of({
          taskId: TASK,
          runId: FIRST,
          steps: [],
          notes: [1],
        }),
        source: 'run',
        proposedBy: 'agent',
        recordedAt: NOW,
      }),
    ],
    failure: null,
    version: 1,
  });
  const approving = [{ id: MemoryId.of('memory_forget') }];

  it('names the memory it retires', () => {
    expect(retiring.retiredBy(FIRST, [MemoryId.of('memory_forget')])).toEqual([
      target.id,
    ]);
  });

  it('is approved while the memory is still active', () => {
    expect(
      retiring.approve({
        runId: FIRST,
        approving,
        decision: BY,
        current: [target],
      }).proposals[0]?.state,
    ).toBe('approved');
  });

  it('is refused once the memory was retired or replaced', () => {
    const retired = target.retire({
      by: UserId.of('user_ada'),
      reason: 'Gone.',
      at: NOW,
    });

    expect(() =>
      retiring.approve({
        runId: FIRST,
        approving,
        decision: BY,
        current: [retired],
      }),
    ).toThrow(new MemoryRetirementLapsedError(['M-3']));
  });
});
