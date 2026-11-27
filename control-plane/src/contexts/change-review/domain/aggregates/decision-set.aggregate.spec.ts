import { DecisionSet } from '@change-review/domain/aggregates/decision-set.aggregate';
import { DecisionDispute } from '@change-review/domain/entities/decision-dispute.entity';
import {
  Decision,
  type ProposedDecision,
} from '@change-review/domain/entities/decision.entity';
import { DecisionsRefusedError } from '@change-review/domain/exceptions/decisions-refused.error';
import { InvalidDecisionError } from '@change-review/domain/exceptions/invalid-decision.error';
import { DecisionDisputeId } from '@change-review/domain/value-objects/decision-dispute-id.vo';
import { DecisionId } from '@change-review/domain/value-objects/decision-id.vo';
import { DecisionMerge } from '@change-review/domain/value-objects/decision-merge.vo';
import { DecisionSetId } from '@change-review/domain/value-objects/decision-set-id.vo';
import { DecisionStatus } from '@change-review/domain/value-objects/decision-status.vo';
import { FilePath } from '@change-review/domain/value-objects/file-path.vo';
import { optionalItems } from '@change-review/testing/optional-items.fake-spec';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
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

const proposed = (
  change: Partial<ProposedDecision> = {},
): ProposedDecision => ({
  kind: 'trade-off',
  title: 'Retries uploads in the request',
  why: 'A queue would need a worker the service does not run yet.',
  alternatives: ['Retry from a queue'],
  paths: ['src/uploads.ts'],
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

const recording = (
  set: DecisionSet,
  runId: RunId,
  decisions: readonly ProposedDecision[],
): DecisionSet => {
  const newId = counting(`${runId.value}_${set.decisions.length}`);

  return set.recordFromRun(
    runId,
    decisions.map((each) => Decision.of(DecisionId.of(newId()), runId, each)),
  );
};

const kinds = (set: DecisionSet) => set.pullEvents().map((each) => each.kind);

describe('a decision', () => {
  const ID = DecisionId.of('decision_1');

  it('keeps the run that recorded it, cites no journal step, and trims its paths', () => {
    const decision = Decision.of(
      ID,
      FIRST,
      proposed({ paths: [' src/uploads.ts ', 'src/uploads.ts'] }),
    );

    expect(decision.recordedIn).toEqual(FIRST);
    expect(decision.journalSteps).toEqual([]);
    expect(decision.paths.map((each) => each.value)).toEqual([
      'src/uploads.ts',
    ]);
  });

  it('is one of the kinds a reviewer is shown', () => {
    expect(() => Decision.of(ID, FIRST, proposed({ kind: 'opinion' }))).toThrow(
      InvalidDecisionError,
    );
  });

  it('covers at least one path, and says which field is wrong', () => {
    expect(() => Decision.of(ID, FIRST, proposed({ paths: [' '] }))).toThrow(
      expect.objectContaining({ field: 'paths' }),
    );
    expect(() => Decision.of(ID, FIRST, proposed({ title: ' ' }))).toThrow(
      expect.objectContaining({ field: 'title' }),
    );
    expect(() =>
      Decision.of(
        ID,
        FIRST,
        proposed({ alternatives: ['a', 'b', 'c', 'd', 'e', 'f'] }),
      ),
    ).toThrow(expect.objectContaining({ field: 'alternatives' }));
  });

  it('comes back as it was stored, with the steps of its run it was drafted from', () => {
    const decision = Decision.rehydrate({
      id: ID,
      kind: 'limitation',
      title: 'x'.repeat(500),
      why: 'Stored before the title limit was tightened.',
      alternatives: [],
      paths: [FilePath.of('src/uploads.ts')],
      recordedIn: FIRST,
      journalSteps: [1],
      disputes: [],
    });

    expect(decision.title).toHaveLength(500);
    expect([decision.recordedIn, decision.journalSteps]).toEqual([FIRST, [1]]);
  });

  it('never comes back with a dispute about a file it does not cover', () => {
    expect(() =>
      Decision.rehydrate({
        id: ID,
        kind: 'limitation',
        title: 'Retries only once',
        why: 'Backoff is not in the client yet.',
        alternatives: [],
        paths: [FilePath.of('src/uploads.ts')],
        recordedIn: FIRST,
        journalSteps: [1],
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

describe('a decision set, recorded by its run', () => {
  it('records the decisions of the run, each with its own id', () => {
    const recorded = recording(opened(), FIRST, [
      proposed(),
      proposed({ title: 'Second' }),
    ]);

    expect(recorded.decisions.map((each) => each.recordedIn.value)).toEqual([
      FIRST.value,
      FIRST.value,
    ]);
    expect(recorded.decisions.map((each) => each.title)).toEqual([
      'Retries uploads in the request',
      'Second',
    ]);
    expect(new Set(recorded.decisions.map((each) => each.id.value)).size).toBe(
      2,
    );
    expect(recorded.pullEvents()).toContainEqual(
      expect.objectContaining({
        kind: 'decision-set.recorded',
        runId: FIRST,
        recorded: 2,
      }),
    );
    expect(recorded.pullEvents()).toEqual([]);
  });

  it('adds what the run records later to what it recorded before', () => {
    const later = recording(recording(opened(), FIRST, [proposed()]), FIRST, [
      proposed({ title: 'Second' }),
    ]);

    expect(later.decisions.map((each) => each.title)).toEqual([
      'Retries uploads in the request',
      'Second',
    ]);
  });

  it('keeps a decision the run records twice once, and records nothing new', () => {
    const once = recording(opened(), FIRST, [proposed(), proposed()]);
    once.pullEvents();
    const twice = recording(once, FIRST, [proposed()]);

    expect(once.decisions).toHaveLength(1);
    expect(twice).toBe(once);
    expect(kinds(twice)).toEqual([]);
  });

  it('keeps each decision with the run that recorded it, and the steps it cites', () => {
    const drafted = DecisionSet.rehydrate({
      id: DecisionSetId.of('set-1'),
      taskId: TaskId.of('task-1'),
      workspaceId: WorkspaceId.of('workspace-1'),
      decisions: [
        Decision.rehydrate({
          id: DecisionId.of('decision_drafted'),
          kind: 'limitation',
          title: 'Retries only once',
          why: 'Backoff is not in the client yet.',
          alternatives: [],
          paths: [FilePath.of('src/uploads.ts')],
          recordedIn: FIRST,
          journalSteps: [3],
          disputes: [],
        }),
      ],
      status: DecisionStatus.proposed(),
      version: 1,
    });

    const later = recording(drafted, SECOND, [proposed({ title: 'Second' })]);

    expect(
      later.decisions.map((each) => [
        each.title,
        each.recordedIn.value,
        each.journalSteps,
      ]),
    ).toEqual([
      ['Retries only once', FIRST.value, [3]],
      ['Second', SECOND.value, []],
    ]);
  });

  it('keeps a decision a later run records again once, with the run that first recorded it', () => {
    const once = recording(opened(), FIRST, [proposed()]);
    once.pullEvents();

    const again = recording(once, SECOND, [proposed()]);

    expect(again).toBe(once);
    expect(again.decisions.map((each) => each.recordedIn)).toEqual([FIRST]);
  });

  it('takes in only decisions of the run that records them', () => {
    expect(() =>
      opened().recordFromRun(FIRST, [
        Decision.of(DecisionId.of('decision_1'), SECOND, proposed()),
      ]),
    ).toThrow(InvalidDecisionError);
  });

  it('records between one and twenty decisions at once', () => {
    const many = Array.from({ length: 21 }, (_, at) =>
      proposed({ title: `Decision ${at}` }),
    );

    expect(() => recording(opened(), FIRST, [])).toThrow(InvalidDecisionError);
    expect(() => recording(opened(), FIRST, many)).toThrow(
      InvalidDecisionError,
    );
  });

  it('keeps only so many decisions', () => {
    const titled = (prefix: string, count: number) =>
      Array.from({ length: count }, (_, at) =>
        proposed({ title: `${prefix} ${at}` }),
      );
    const full = [
      titled('One', 20),
      titled('Two', 20),
      titled('Three', 10),
    ].reduce((set, decisions) => recording(set, FIRST, decisions), opened());

    expect(full.decisions).toHaveLength(50);
    expect(() =>
      recording(full, SECOND, [proposed({ title: 'One more' })]),
    ).toThrow(DecisionsRefusedError);
  });

  it('never comes back with the same decision twice', () => {
    const recorded = recording(opened(), FIRST, [proposed()]);

    expect(() =>
      DecisionSet.rehydrate({
        id: recorded.id,
        taskId: recorded.taskId,
        workspaceId: recorded.workspaceId,
        decisions: [...recorded.decisions, ...recorded.decisions],
        status: recorded.status,
        version: 1,
      }),
    ).toThrow(InconsistentStateError);
  });
});

describe('a decision set, merged', () => {
  it('merges, and keeps the commit of the merge', () => {
    const merged = recording(opened(), FIRST, [proposed()]).merge(MERGE);

    expect(merged.status.isMerged).toBe(true);
    expect(merged.status.merges[0]?.commit.value).toBe('a'.repeat(40));
    expect(merged.status.merges[0]?.repository.value).toBe('acme/api');
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

describe('a decision set, merged in more than one repository', () => {
  const API = Repository.of('acme/api');
  const WEB = Repository.of('acme/web');
  const mergeOf = (repository: Repository, commit: string) =>
    DecisionMerge.of({ repository, commit: commit.repeat(40), at: NOW });

  const decided = () =>
    recording(opened(), FIRST, [
      proposed({ title: 'Retries uploads', paths: ['api/src/uploads.ts'] }),
      proposed({ title: 'Polls every second', paths: ['web/src/poll.ts'] }),
    ]);

  const titles = (decisions: readonly Decision[]) =>
    decisions.map((each) => each.title);

  it('records one merge for each repository, each with its own commit', () => {
    const merged = decided().merge(mergeOf(API, 'a')).merge(mergeOf(WEB, 'b'));

    expect(
      merged.status.merges.map((each) => [
        each.repository.value,
        each.commit.value,
      ]),
    ).toEqual([
      ['acme/api', 'a'.repeat(40)],
      ['acme/web', 'b'.repeat(40)],
    ]);
    expect(merged.status.mergeIn(WEB)?.commit.value).toBe('b'.repeat(40));
  });

  it('merges the decisions on a repository’s files only once that repository merges', () => {
    const apiMerged = decided().merge(mergeOf(API, 'a'));

    expect(titles(apiMerged.mergedIn(API))).toEqual(['Retries uploads']);
    expect(apiMerged.mergedIn(WEB)).toEqual([]);

    const bothMerged = apiMerged.merge(mergeOf(WEB, 'b'));

    expect(titles(bothMerged.mergedIn(WEB))).toEqual(['Polls every second']);
    expect(titles(bothMerged.mergedIn(API))).toEqual(['Retries uploads']);
  });

  it('keeps the first merge of a repository', () => {
    const merged = decided().merge(mergeOf(API, 'a')).merge(mergeOf(API, 'c'));

    expect(merged.status.merges.map((each) => each.commit.value)).toEqual([
      'a'.repeat(40),
    ]);
  });

  it('takes no later run and is kept once any repository merges', () => {
    const apiMerged = decided().merge(mergeOf(API, 'a'));

    expect(() =>
      recording(apiMerged, SECOND, [proposed({ title: 'Later' })]),
    ).toThrow(DecisionsRefusedError);
    expect(apiMerged.closedUnmerged(WEB, [])).not.toBeNull();
  });

  it('drops only the decisions of a repository whose pull request closes unmerged', () => {
    const kept = decided().closedUnmerged(API, [API, WEB]);

    expect(kept && titles(kept.decisions)).toEqual(['Polls every second']);
  });

  it('keeps a decision that is also on a repository still open', () => {
    const spanning = recording(opened(), FIRST, [
      proposed({
        title: 'Shares the retry policy',
        paths: ['api/src/uploads.ts', 'web/src/poll.ts'],
      }),
    ]);

    expect(spanning.closedUnmerged(API, [API, WEB])).toBe(spanning);
  });

  it('is discarded once no repository still has an open pull request', () => {
    const afterApi = decided().closedUnmerged(API, [API, WEB]);

    expect(
      afterApi?.closedUnmerged(Repository.of('Acme/Web'), [WEB]),
    ).toBeNull();
  });

  it('does not rehydrate two merges into one repository', () => {
    expect(() =>
      DecisionStatus.rehydrate({
        state: 'merged',
        merges: [mergeOf(API, 'a'), mergeOf(Repository.of('Acme/API'), 'b')],
      }),
    ).toThrow(InconsistentStateError);
  });
});

describe('a decision set, merged in one repository', () => {
  it('merges every decision on the repository’s files, and stays merged', () => {
    const API = Repository.of('acme/api');
    const merged = recording(opened(), FIRST, [
      proposed({ paths: ['api/src/uploads.ts'] }),
      proposed({ title: 'Second', paths: ['api/src/retry.ts'] }),
    ]).merge(MERGE);

    expect(merged.status.state).toBe('merged');
    expect(merged.mergedIn(API)).toEqual(merged.decisions);
    expect(merged.mergedIn(API)).toHaveLength(2);
    expect(() =>
      recording(merged, SECOND, [proposed({ title: 'Later' })]),
    ).toThrow(DecisionsRefusedError);
    expect(merged.closedUnmerged(API, [])).toBe(merged);
  });
});

describe('a decision set, closed without a merge', () => {
  it('is discarded when its only pull request closes', () => {
    const API = Repository.of('acme/api');

    expect(
      recording(opened(), FIRST, [proposed()]).closedUnmerged(API, [API]),
    ).toBeNull();
  });

  it('keeps what is already merged', () => {
    expect(
      opened().merge(MERGE).closedUnmerged(Repository.of('acme/web'), []),
    ).not.toBeNull();
  });
});

describe('a decision set, disputed', () => {
  const decided = () =>
    recording(opened(), FIRST, [proposed(), proposed({ title: 'Second' })]);
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
      decisionId: over.decisionId ?? set.decisions[1]?.id,
      path: FilePath.of(over.path ?? 'src/uploads.ts'),
      by: MAYA,
      reason: over.reason ?? ' The client retries twice already. ',
      now: NOW,
    });

  it('records who disputes a decision, and why', () => {
    const set = decided();
    const [first, second] = optionalItems(set.decisions);
    if (first === undefined || second === undefined) {
      throw new Error('expected two decisions');
    }
    const disputed = dispute(set);

    expect(disputed.decisions[1]?.disputes.map((each) => each.reason)).toEqual([
      'The client retries twice already.',
    ]);
    expect(disputed.decisions[0]?.disputes).toEqual([]);
    expect(disputed.pullEvents()).toContainEqual(
      expect.objectContaining({
        kind: 'decision-set.disputed',
        decisionId: second.id,
        path: FilePath.of('src/uploads.ts'),
      }),
    );
    expect(first.id.equals(second.id)).toBe(false);
  });

  it('records every dispute, as a thread of replies', () => {
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

  it('rejects a dispute of a file the decision does not cover, or without a reason', () => {
    expect(() => dispute(decided(), { path: 'src/elsewhere.ts' })).toThrow(
      InvalidDecisionError,
    );
    expect(() => dispute(decided(), { reason: '  ' })).toThrow(
      InvalidDecisionError,
    );
  });

  it('keeps disputes when a later run records more', () => {
    const later = recording(dispute(decided()), SECOND, [
      proposed({ title: 'Third' }),
    ]);

    expect(later.decisions.flatMap((each) => each.disputes)).toHaveLength(1);
    expect(() =>
      dispute(later, { id: 'dispute_2', decisionId: later.decisions[1]?.id }),
    ).not.toThrow();
  });
});
