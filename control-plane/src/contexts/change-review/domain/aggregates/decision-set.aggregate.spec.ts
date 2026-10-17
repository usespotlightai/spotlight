import { DecisionSet } from '@change-review/domain/aggregates/decision-set.aggregate';
import {
  Decision,
  type ProposedDecision,
} from '@change-review/domain/entities/decision.entity';
import { DecisionDispute } from '@change-review/domain/entities/decision-dispute.entity';
import { InvalidDecisionError } from '@change-review/domain/exceptions/invalid-decision.error';
import { UnknownDecisionError } from '@change-review/domain/exceptions/unknown-decision.error';
import { DecisionDisputeId } from '@change-review/domain/value-objects/decision-dispute-id.vo';
import { DecisionGrounds } from '@change-review/domain/value-objects/decision-grounds.vo';
import { DecisionId } from '@change-review/domain/value-objects/decision-id.vo';
import { DecisionMerge } from '@change-review/domain/value-objects/decision-merge.vo';
import { DecisionSetId } from '@change-review/domain/value-objects/decision-set-id.vo';
import { DecisionStatus } from '@change-review/domain/value-objects/decision-status.vo';
import { FilePath } from '@change-review/domain/value-objects/file-path.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { MAX_JOB_ATTEMPTS } from '@shared-kernel/domain/value-objects/pending-job.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-21T10:00:00Z');
const FIRST = RunId.of('run-1');
const SECOND = RunId.of('run-2');
const MAYA = UserId.of('user_maya');
const MERGE = DecisionMerge.of({
  repository: Repository.of('acme/api'),
  commit: 'A'.repeat(40),
  at: NOW,
});

const GROUNDS = DecisionGrounds.of({
  steps: [2, 5, 9],
  changed: ['src/uploads.ts', 'src/retry.ts'],
});

const proposed = (
  change: Partial<ProposedDecision> = {},
): ProposedDecision => ({
  kind: 'trade-off',
  title: 'Retries uploads in the request',
  why: 'A queue would need a worker the service does not run yet.',
  alternatives: ['Retry from a queue'],
  paths: ['src/uploads.ts'],
  steps: [5],
  ...change,
});

const counting = (prefix: string) => {
  let next = 0;
  return () => {
    next += 1;
    return `${prefix}_${next}`;
  };
};

const opened = () =>
  DecisionSet.open({
    id: DecisionSetId.of('set-1'),
    taskId: TaskId.of('task-1'),
    workspaceId: WorkspaceId.of('workspace-1'),
  });

const drafting = (
  set: DecisionSet,
  runId: RunId,
  decisions: readonly ProposedDecision[],
): DecisionSet =>
  set.recordDraft({
    runId,
    proposed: decisions,
    grounds: GROUNDS,
    newId: counting(runId.value),
  });

const kinds = (set: DecisionSet) => set.pullEvents().map((each) => each.kind);

describe('a decision', () => {
  const ID = DecisionId.of('decision_1');

  it('keeps its steps once each, in order, and its paths trimmed', () => {
    const decision = Decision.of(
      ID,
      proposed({
        steps: [9, 2, 9],
        paths: [' src/uploads.ts ', 'src/uploads.ts'],
      }),
    );

    expect(decision.steps).toEqual([2, 9]);
    expect(decision.paths.map((each) => each.value)).toEqual([
      'src/uploads.ts',
    ]);
  });

  it('is one of the kinds a reviewer is shown', () => {
    expect(() => Decision.of(ID, proposed({ kind: 'opinion' }))).toThrow(
      InvalidDecisionError,
    );
  });

  it('bears on at least one path and cites at least one step', () => {
    expect(() => Decision.of(ID, proposed({ paths: [' '] }))).toThrow(
      InvalidDecisionError,
    );
    expect(() => Decision.of(ID, proposed({ steps: [] }))).toThrow(
      InvalidDecisionError,
    );
    expect(() => Decision.of(ID, proposed({ steps: [-1] }))).toThrow(
      InvalidDecisionError,
    );
  });

  it('comes back as it was kept, even past limits it was drafted under', () => {
    const decision = Decision.rehydrate({
      id: ID,
      kind: 'limitation',
      title: 'x'.repeat(500),
      why: 'Kept before the title limit was tightened.',
      alternatives: [],
      paths: [FilePath.of('src/uploads.ts')],
      steps: [1],
      disputes: [],
    });

    expect(decision.title).toHaveLength(500);
  });

  it('never comes back with a dispute about a file it does not bear on', () => {
    expect(() =>
      Decision.rehydrate({
        id: ID,
        kind: 'limitation',
        title: 'Retries only once',
        why: 'Backoff is not in the client yet.',
        alternatives: [],
        paths: [FilePath.of('src/uploads.ts')],
        steps: [1],
        disputes: [
          DecisionDispute.rehydrate({
            id: DecisionDisputeId.of('dispute_1'),
            path: FilePath.of('src/elsewhere.ts'),
            by: MAYA,
            reason: 'No',
            at: NOW,
          }),
        ],
      }),
    ).toThrow(InconsistentStateError);
  });
});

describe('a decision set, asked to draft', () => {
  it('drafts the run that asked', () => {
    const asked = opened().asked(FIRST, NOW);

    expect(asked.hasPendingJob).toBe(true);
    expect(asked.draft?.isFor(FIRST)).toBe(true);
    expect(kinds(asked)).toEqual(['decisions.asked']);
  });

  it('hears the same run once', () => {
    const asked = opened().asked(FIRST, NOW);
    asked.pullEvents();

    expect(kinds(asked.asked(FIRST, NOW))).toEqual([]);
  });

  it('does not draft again a run it already drafted', () => {
    const drafted = drafting(opened().asked(FIRST, NOW), FIRST, [proposed()]);
    drafted.pullEvents();

    const again = drafted.asked(FIRST, NOW);

    expect(again.hasPendingJob).toBe(false);
    expect(kinds(again)).toEqual([]);
  });

  it('drafts a newer run in place of one still waiting', () => {
    const asked = opened().asked(FIRST, NOW).asked(SECOND, NOW);

    expect(asked.draft?.isFor(SECOND)).toBe(true);
  });

  it('hears no later run after its decisions merge', () => {
    const merged = drafting(opened().asked(FIRST, NOW), FIRST, [
      proposed(),
    ]).merge(MERGE);
    merged.pullEvents();

    const asked = merged.asked(SECOND, NOW);

    expect(asked.hasPendingJob).toBe(false);
    expect(asked.decidedIn?.equals(FIRST)).toBe(true);
    expect(kinds(asked)).toEqual([]);
  });
});

describe('a decision set, drafted', () => {
  it('keeps only the decisions its run grounds, each with its own id', () => {
    const drafted = drafting(opened().asked(FIRST, NOW), FIRST, [
      proposed(),
      proposed({ title: 'Cites a step the run does not have', steps: [3] }),
      proposed({
        title: 'Bears on a file it never changed',
        paths: ['README.md'],
      }),
      proposed({ kind: 'hunch' }),
    ]);

    expect(drafted.decisions.map((each) => each.title)).toEqual([
      'Retries uploads in the request',
    ]);
    expect(drafted.decisions[0]?.id.value).toBe('run-1_1');
    expect(drafted.decidedIn?.equals(FIRST)).toBe(true);
    expect(drafted.hasPendingJob).toBe(false);

    const [, recorded] = drafted.pullEvents();
    expect(recorded).toMatchObject({
      kind: 'decisions.recorded',
      kept: 1,
      dropped: 3,
    });
  });

  it('replaces what an earlier run decided', () => {
    const drafted = drafting(
      drafting(opened().asked(FIRST, NOW), FIRST, [proposed()]).asked(
        SECOND,
        NOW,
      ),
      SECOND,
      [proposed({ kind: 'limitation', title: 'Retries only once' })],
    );

    expect(drafted.decisions.map((each) => each.title)).toEqual([
      'Retries only once',
    ]);
    expect(drafted.decidedIn?.equals(SECOND)).toBe(true);
  });

  it('records that a run decided nothing', () => {
    const drafted = drafting(
      drafting(opened().asked(FIRST, NOW), FIRST, [proposed()]).asked(
        SECOND,
        NOW,
      ),
      SECOND,
      [],
    );

    expect(drafted.decisions).toEqual([]);
  });

  it('ignores a draft of a run it is no longer drafting', () => {
    const asked = opened().asked(FIRST, NOW).asked(SECOND, NOW);

    const drafted = drafting(asked, FIRST, [proposed()]);

    expect(drafted).toBe(asked);
    expect(drafted.decisions).toEqual([]);
  });

  it('never comes back with the same decision twice', () => {
    const decision = Decision.of(DecisionId.of('decision_1'), proposed());

    expect(() =>
      DecisionSet.rehydrate({
        id: DecisionSetId.of('set-1'),
        taskId: TaskId.of('task-1'),
        workspaceId: WorkspaceId.of('workspace-1'),
        decidedIn: FIRST,
        decisions: [decision, decision],
        draft: null,
        status: DecisionStatus.proposed(),
        version: 1,
      }),
    ).toThrow(InconsistentStateError);
  });
});

describe('a decision set, failing to draft', () => {
  it('keeps what an earlier run decided when a later one cannot be drafted', () => {
    const failed = drafting(opened().asked(FIRST, NOW), FIRST, [proposed()])
      .asked(SECOND, NOW)
      .deadLetter();

    expect(failed.decisions).toHaveLength(1);
    expect(failed.decidedIn?.equals(FIRST)).toBe(true);
    expect(failed.hasPendingJob).toBe(false);
    expect(kinds(failed)).toContain('decisions.drafting-failed');
  });

  it('is retried later, then dead-lettered', () => {
    let set = opened().asked(FIRST, NOW);

    for (let attempt = 0; attempt < MAX_JOB_ATTEMPTS; attempt += 1) {
      const due = set.draft?.job.nextAttemptAt ?? NOW;
      set = set.leaseJob(due).scheduleRetry(due);
    }

    expect(set.hasPendingJob).toBe(false);
    expect(kinds(set)).toContain('decisions.drafting-failed');
  });

  it('says its job is exhausted once every attempt is spent', () => {
    let set = opened().asked(FIRST, NOW);

    for (let attempt = 0; attempt < MAX_JOB_ATTEMPTS; attempt += 1) {
      set = set.leaseJob(set.draft?.job.nextAttemptAt ?? NOW);
    }

    expect(set.jobExhausted).toBe(true);
  });

  it('cannot be leased with nothing to draft', () => {
    expect(() => opened().leaseJob(NOW)).toThrow(InvalidDecisionError);
  });

  it('cannot be leased again while the lease is active', () => {
    const leased = opened().asked(FIRST, NOW).leaseJob(NOW);

    expect(() => leased.leaseJob(NOW)).toThrow(InvalidDecisionError);
  });
});

describe('a decision set, merged', () => {
  it('merges, and keeps the commit of the merge', () => {
    const merged = drafting(opened().asked(FIRST, NOW), FIRST, [
      proposed(),
    ]).merge(MERGE);

    expect(merged.status.isMerged).toBe(true);
    expect(merged.status.merge?.commit).toBe('a'.repeat(40));
    expect(merged.status.merge?.repository.value).toBe('acme/api');
    expect(merged.pullEvents()).toContainEqual(
      expect.objectContaining({
        kind: 'decisions.merged',
        commit: 'a'.repeat(40),
      }),
    );
  });

  it('merges once', () => {
    const merged = opened().merge(MERGE);
    merged.pullEvents();

    expect(
      kinds(
        merged.merge(
          DecisionMerge.of({
            repository: Repository.of('acme/api'),
            commit: 'b'.repeat(40),
            at: NOW,
          }),
        ),
      ),
    ).toEqual([]);
  });

  it('merges only with a merge commit named by its full hash', () => {
    expect(() =>
      DecisionMerge.of({
        repository: Repository.of('acme/api'),
        commit: 'abc123',
        at: NOW,
      }),
    ).toThrow(InvalidDecisionError);
  });
});

describe('a decision set, closed without a merge', () => {
  it('is discarded', () => {
    const discarded = drafting(opened().asked(FIRST, NOW), FIRST, [
      proposed(),
    ]).closeUnmerged();

    expect(discarded.discarded).toBe(true);
    expect(kinds(discarded)).toContain('decisions.discarded');
  });

  it('keeps what is already merged', () => {
    const merged = opened().merge(MERGE);
    merged.pullEvents();

    const closed = merged.closeUnmerged();

    expect(closed.discarded).toBe(false);
    expect(kinds(closed)).toEqual([]);
  });
});

describe('a decision set, disputed', () => {
  const decided = () =>
    drafting(opened().asked(FIRST, NOW), FIRST, [
      proposed(),
      proposed({ title: 'Second' }),
    ]);
  const dispute = (
    set: DecisionSet,
    over: {
      id?: string;
      decisionId?: DecisionId;
      path?: string;
      reason?: string;
    } = {},
  ) =>
    set.dispute({
      id: DecisionDisputeId.of(over.id ?? 'dispute_1'),
      decisionId: over.decisionId ?? (set.decisions[1]?.id as DecisionId),
      path: FilePath.of(over.path ?? 'src/uploads.ts'),
      by: MAYA,
      reason: over.reason ?? ' The client retries twice already. ',
      now: NOW,
    });

  it('keeps who disputes a decision, and why', () => {
    const set = decided();
    const [first, second] = set.decisions;
    const disputed = dispute(set);

    expect(disputed.decisions[1]?.disputes.map((each) => each.reason)).toEqual([
      'The client retries twice already.',
    ]);
    expect(disputed.decisions[0]?.disputes).toEqual([]);
    expect(disputed.pullEvents()).toContainEqual(
      expect.objectContaining({
        kind: 'decisions.disputed',
        decisionId: second?.id,
        path: FilePath.of('src/uploads.ts'),
      }),
    );
    expect(first?.id.equals(second?.id as DecisionId)).toBe(false);
  });

  it('keeps every dispute, as a thread of replies', () => {
    const set = decided();
    const disputed = dispute(dispute(set, { reason: 'First thought' }), {
      id: 'dispute_2',
      reason: 'Second thought',
    });

    expect(disputed.decisions[1]?.disputes.map((each) => each.reason)).toEqual([
      'First thought',
      'Second thought',
    ]);
  });

  it('rejects a dispute of a file the decision does not bear on, or without a reason', () => {
    expect(() => dispute(decided(), { path: 'src/elsewhere.ts' })).toThrow(
      InvalidDecisionError,
    );
    expect(() => dispute(decided(), { reason: '  ' })).toThrow(
      InvalidDecisionError,
    );
  });

  it('knows no decision a later run replaced', () => {
    const earlier = decided();
    const stale = earlier.decisions[1]?.id as DecisionId;
    const replaced = drafting(earlier.asked(SECOND, NOW), SECOND, [
      proposed(),
      proposed({ title: 'Second' }),
    ]);

    expect(() => dispute(replaced, { decisionId: stale })).toThrow(
      UnknownDecisionError,
    );
  });

  it('drops disputes with the decisions a later run replaces', () => {
    const replaced = drafting(dispute(decided()).asked(SECOND, NOW), SECOND, [
      proposed(),
    ]);

    expect(replaced.decisions.flatMap((each) => each.disputes)).toEqual([]);
  });
});
