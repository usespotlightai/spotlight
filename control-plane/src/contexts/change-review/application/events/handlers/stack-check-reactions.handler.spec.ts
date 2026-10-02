import { StackCheckReactions } from '@change-review/application/events/handlers/stack-check-reactions.handler';
import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import { ChangeStackSettled } from '@change-review/domain/events/change-stack-settled.event';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import {
  Diff,
  type DiffFile,
} from '@change-review/domain/value-objects/diff.vo';
import type { ProposedCohort } from '@change-review/domain/value-objects/stack-cohort.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-16T10:00:00Z');

const LATER = new Date(NOW.getTime() + 60_000);

const CHECKER = RunnerId.of('checker_1');

const STACK = ChangeStackId.of('stack-1');

const TASK = TaskId.of('task-1');

const changed = (path: string, at: number): DiffFile => ({
  path,
  previousPath: null,
  status: 'modified',
  binary: false,
  hunks: [
    {
      id: HunkId.at(at + 1),
      oldStart: 1,
      oldLines: 1,
      newStart: 1,
      newLines: 1,
      patch: '@@ -1 +1 @@\n-before\n+after',
    },
  ],
});

const DIFF = Diff.of(['schema.ts', 'api.ts'].map(changed));

const cohort = (hunks: string[][]): ProposedCohort => ({
  kind: 'change',
  title: 'Invitations',
  intent: 'Invitations',
  layers: hunks.map((each, at) => ({
    title: `Layer ${at + 1}`,
    summary: `Layer ${at + 1}`,
    dependsOn: [],
    ranges: each.map((hunk) => ({ hunk: HunkId.of(hunk) })),
    notes: each.map((hunk) => ({
      path: DIFF.fileOf(hunk)?.path ?? hunk,
      note: 'Why',
    })),
  })),
});

const stackWith = (request: CheckRequest | null) =>
  ChangeStack.draft({
    id: STACK,
    runId: RunId.of('run-1'),
    taskId: TASK,
    replay: false,
    isSearch: false,
    workspaceId: WorkspaceId.of('workspace-1'),
    repository: null,
    base: null,
    diff: DIFF,
    facts: StackFacts.none(),
    request,
    now: NOW,
  }).propose([cohort([['h1'], ['h2']])], LATER);

const reacting = (stack: ChangeStack | null, check: StackCheck | null) => {
  const added: StackCheck[] = [];
  const saved: StackCheck[] = [];
  const kept: ChangeStack[] = [];

  const stacks = {
    find: async () => stack,
    save: async (each: ChangeStack) => {
      kept.push(each);
    },
  } as unknown as ChangeStackRepository;

  const checks = {
    find: async () => check,
    add: async (each: StackCheck) => {
      added.push(each);
    },
    save: async (each: StackCheck) => {
      saved.push(each);
    },
  } as unknown as StackCheckRepository;

  return {
    reactions: new StackCheckReactions(checks, stacks, {
      now: () => LATER,
      sleep: async () => undefined,
    }),
    added,
    saved,
    kept,
  };
};

const checkFor = (stack: ChangeStack) =>
  StackCheck.begin({
    stackId: stack.id,
    runId: stack.runId,
    taskId: stack.taskId,
    replay: false,
    workspaceId: stack.workspaceId,
    request: CheckRequest.of('npm test', null),
    entries: stack.entries(),
    now: LATER,
  });

describe('StackCheckReactions', () => {
  it('begins a check once a stack that asked for one settles', async () => {
    const stack = stackWith(CheckRequest.of('npm test', 'npm ci'));
    const { reactions, added } = reacting(stack, null);

    await reactions.onSettled(
      new ChangeStackSettled(STACK, stack.runId, false),
    );

    expect(added).toHaveLength(1);
    expect(added[0]?.request.setup).toBe('npm ci');
    expect(added[0]?.taskId).toEqual(TASK);
    expect(added[0]?.stateAt(LATER)).toBe('waiting');
  });

  it('begins no check for a stack that asked for none', async () => {
    const stack = stackWith(null);
    const { reactions, added } = reacting(stack, null);

    await reactions.onSettled(
      new ChangeStackSettled(STACK, stack.runId, false),
    );

    expect(added).toEqual([]);
  });

  it('asks the stack to reorder once its layers fail', async () => {
    const stack = stackWith(CheckRequest.of('npm test', null));
    const { reactions, kept } = reacting(stack, null);

    await reactions.onLayersFailed(STACK);

    expect(kept[0]?.reordering).toBe(true);
  });

  it('hands the reordered layers to the check', async () => {
    const stack = stackWith(CheckRequest.of('npm test', null));
    const reordering = checkFor(stack)
      .claimedFor(CHECKER, RunnerTerms.none(), LATER)
      .recorded(
        CHECKER,
        { steps: stack.checkSteps(stack.entries()), layers: stack.layers() },
        [
          { step: 'whole', passed: true, output: '', tookMs: 1 },
          { step: stack.layers()[0], passed: false, output: 'no', tookMs: 1 },
        ],
        LATER,
      );
    const { reactions, saved } = reacting(stack, reordering);

    await reactions.onReordered(STACK);

    expect(saved[0]?.phase).toBe('waiting');
    expect(saved[0]?.rounds).toBe(1);
  });

  it('keeps the checked layers once reordering ends', async () => {
    const stack = stackWith(CheckRequest.of('npm test', null));
    const reordering = checkFor(stack)
      .claimedFor(CHECKER, RunnerTerms.none(), LATER)
      .recorded(
        CHECKER,
        { steps: stack.checkSteps(stack.entries()), layers: stack.layers() },
        [
          { step: 'whole', passed: true, output: '', tookMs: 1 },
          { step: stack.layers()[0], passed: false, output: 'no', tookMs: 1 },
        ],
        LATER,
      );
    const { reactions, saved } = reacting(stack, reordering);

    await reactions.onReorderingEnded(STACK);

    expect(saved[0]?.stateAt(LATER)).toBe('checked');
  });
});
