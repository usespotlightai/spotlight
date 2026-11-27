import { MemoryProposalSet } from '@memory/domain/aggregates/memory-proposal-set.aggregate';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { MemoryProposal } from '@memory/domain/entities/memory-proposal.entity';
import { MemoryApproved } from '@memory/domain/events/memory-approved.event';
import { MemoryReviewReopened } from '@memory/domain/events/memory-review-reopened.event';
import { MemoryReviewRequested } from '@memory/domain/events/memory-review-requested.event';
import { MemoryReviewResolved } from '@memory/domain/events/memory-review-resolved.event';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { MemoryAlreadyDecidedError } from '@memory/domain/exceptions/memory-already-decided.error';
import { MemoryRetirementLapsedError } from '@memory/domain/exceptions/memory-retirement-lapsed.error';
import { UnknownMemoryError } from '@memory/domain/exceptions/unknown-memory.error';
import { Remembering } from '@memory/domain/services/remembering';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryProposalSetId } from '@memory/domain/value-objects/memory-proposal-set-id.vo';
import { MemoryProvenance } from '@memory/domain/value-objects/memory-provenance.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
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

const created = () =>
  MemoryProposalSet.create({
    id: MemoryProposalSetId.of('draft_1'),
    taskId: TASK,
    workspaceId: WorkspaceId.of('ws_1'),
  });

let made = 0;
const newId = () => {
  made += 1;
  return `memory_${made}`;
};

const proposedByRun = (
  runId: RunId,
  body = 'Uploads retry in the request, not from a queue.',
  id = 'memory_remembered',
  fromOutside = false,
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
      steps: [{ index: 3, kind: 'remember', commands: [] }],
      cited: [],
      fromOutside,
    },
    now: NOW,
  });

const rememberedAll = (bodies: readonly string[], fromOutside = false) => {
  const set = bodies.reduce(
    (each, body) =>
      each.remember(proposedByRun(FIRST, body, newId(), fromOutside)),
    created(),
  );
  set.pullEvents();
  return set;
};

describe('MemoryProposalSet', () => {
  describe('deciding', () => {
    const ADA = MemoryDecision.of({ by: UserId.of('user_ada'), at: LATER });

    const three = () => rememberedAll(['First.', 'Second.', 'Third.']);

    const outside = () =>
      rememberedAll(['From outside.', 'Also from outside.'], true);

    const idOf = (set: MemoryProposalSet, at: number) => {
      const proposal = set.proposals[at];
      if (!proposal) throw new Error('no proposal there');
      return proposal.id;
    };

    it('approves a memory, recording who approved it and when', () => {
      const set = three();

      const approved = set.approve({
        runId: FIRST,
        approving: [{ id: idOf(set, 0) }],
        decision: ADA,
        current: [],
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
      const set = three();
      const before = set.proposals[0];

      const approved = set.approve({
        runId: FIRST,
        approving: [{ id: idOf(set, 0), body: '  Edited.  ' }],
        decision: ADA,
        current: [],
      });

      expect(approved.proposals[0]?.body.value).toBe('Edited.');
      expect(
        before && approved.proposals[0]?.provenance.equals(before.provenance),
      ).toBe(true);
    });

    it('approves several memories at once', () => {
      const set = three();

      const approved = set.approve({
        runId: FIRST,
        approving: [{ id: idOf(set, 0) }, { id: idOf(set, 1) }],
        decision: ADA,
        current: [],
      });

      expect(approved.proposals.map((each) => each.state)).toEqual([
        'approved',
        'approved',
        'proposed',
      ]);
    });

    it('approves a memory from outside the team only on its own', () => {
      const set = outside();

      expect(() =>
        set.approve({
          runId: FIRST,
          approving: [{ id: idOf(set, 0) }, { id: idOf(set, 1) }],
          decision: ADA,
          current: [],
        }),
      ).toThrow(InvalidMemoryError);
      expect(
        set.approve({
          runId: FIRST,
          approving: [{ id: idOf(set, 0) }],
          decision: ADA,
          current: [],
        }).proposals[0]?.state,
      ).toBe('approved');
    });

    it('rejects a memory and stores it, announcing no approval', () => {
      const set = three();

      const rejected = set.reject({
        runId: FIRST,
        id: idOf(set, 2),
        decision: ADA,
      });

      expect(rejected.proposals[2]?.state).toBe('rejected');
      expect(rejected.proposals).toHaveLength(3);
      expect(rejected.pullEvents()).toEqual([]);
    });

    it('takes a rejection back, so the memory waits for a decision and its review opens again', () => {
      const set = three();
      const rejected = set.reject({
        runId: FIRST,
        id: idOf(set, 2),
        decision: ADA,
      });
      rejected.pullEvents();

      const restored = rejected.restore({ runId: FIRST, id: idOf(set, 2) });

      expect(restored.proposals[2]?.state).toBe('proposed');
      expect(restored.proposals[2]?.decision).toBeNull();
      expect(restored.pullEvents()).toEqual([
        new MemoryReviewReopened(set.id, set.taskId, FIRST),
      ]);
    });

    it('takes back only a rejection', () => {
      const set = three();
      const approved = set.approve({
        runId: FIRST,
        approving: [{ id: idOf(set, 0) }],
        decision: ADA,
        current: [],
      });

      expect(() => set.restore({ runId: FIRST, id: idOf(set, 1) })).toThrow(
        MemoryAlreadyDecidedError,
      );
      expect(() =>
        approved.restore({ runId: FIRST, id: idOf(set, 0) }),
      ).toThrow(MemoryAlreadyDecidedError);
    });

    it('decides a memory only once', () => {
      const set = three();
      const rejected = set.reject({
        runId: FIRST,
        id: idOf(set, 0),
        decision: ADA,
      });

      expect(() =>
        rejected.approve({
          runId: FIRST,
          approving: [{ id: idOf(set, 0) }],
          decision: ADA,
          current: [],
        }),
      ).toThrow(MemoryAlreadyDecidedError);
    });

    it('rejects a memory of another run than the one under review', () => {
      const set = three();

      expect(() =>
        set.reject({ runId: SECOND, id: idOf(set, 0), decision: ADA }),
      ).toThrow(UnknownMemoryError);
    });

    it('rejects a memory it does not contain, or one named twice', () => {
      const set = three();

      expect(() =>
        set.reject({
          runId: FIRST,
          id: MemoryId.of('memory_elsewhere'),
          decision: ADA,
        }),
      ).toThrow(UnknownMemoryError);
      expect(() =>
        set.approve({
          runId: FIRST,
          approving: [{ id: idOf(set, 0) }, { id: idOf(set, 0) }],
          decision: ADA,
          current: [],
        }),
      ).toThrow(InvalidMemoryError);
    });

    it('resolves a run’s review once nothing it proposed is left to decide', () => {
      let set = three();

      set = set.approve({
        runId: FIRST,
        approving: [{ id: idOf(set, 0) }, { id: idOf(set, 1) }],
        decision: ADA,
        current: [],
      });
      expect(set.pullEvents()).not.toContainEqual(
        expect.any(MemoryReviewResolved),
      );

      set = set.reject({
        runId: FIRST,
        id: idOf(set, 2),
        decision: ADA,
      });
      expect(set.pullEvents()).toEqual([
        new MemoryReviewResolved(set.id, TASK, FIRST),
      ]);
    });
  });

  describe('remembering', () => {
    it('takes in what a run proposed to remember and puts it to a person', () => {
      const set = created().remember(proposedByRun(FIRST));

      expect(set.proposals.map((each) => each.id.value)).toEqual([
        'memory_remembered',
      ]);
      expect(set.citedBy(FIRST).map((each) => each.steps)).toEqual([[3]]);
      expect(set.pullEvents()).toEqual([
        new MemoryReviewRequested(set.id, TASK, FIRST),
      ]);
    });

    it('takes in the same memory from the same run only once', () => {
      const set = created().remember(proposedByRun(FIRST));
      set.pullEvents();
      const again = proposedByRun(FIRST, undefined, 'memory_again');

      expect(set.remember(again)).toBe(set);
      expect(set.findProposal(again)?.id.value).toBe('memory_remembered');
    });

    it('rejects a proposal decided already, or one of another task', () => {
      const decided = proposedByRun(FIRST).reject(
        MemoryDecision.of({ by: UserId.of('user_ada'), at: LATER }),
      );

      expect(() => created().remember(decided)).toThrow(InvalidMemoryError);
      expect(() =>
        MemoryProposalSet.create({
          id: MemoryProposalSetId.of('draft_2'),
          taskId: TaskId.of('task_other'),
          workspaceId: WorkspaceId.of('ws_1'),
        }).remember(proposedByRun(FIRST)),
      ).toThrow(InvalidMemoryError);
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
        supersedes: null,
        recordedAt: NOW,
      });

      expect(() =>
        MemoryProposalSet.rehydrate({
          id: MemoryProposalSetId.of('draft_1'),
          taskId: TASK,
          workspaceId: WorkspaceId.of('ws_1'),
          proposals: [other],
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
  const retiring = MemoryProposalSet.rehydrate({
    id: MemoryProposalSetId.of('set_1'),
    taskId: TASK,
    workspaceId: WorkspaceId.of('ws_1'),
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
        recordedAt: NOW,
      }),
    ],
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
