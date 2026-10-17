import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
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
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

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

const DIFF = Diff.of(
  ['schema.ts', 'api.ts', 'form.tsx', 'package-lock.json', 'docs.md'].map(
    changed,
  ),
);

const NOW = new Date('2026-09-16T10:00:00Z');

const LATER = new Date(NOW.getTime() + 60_000);

const cohort = (
  title: string,
  layers: string[][],
  kind: ProposedCohort['kind'] = 'change',
): ProposedCohort => ({
  kind,
  title,
  intent: title,
  layers: layers.map((hunks, at) => ({
    title: `${title} ${at + 1}`,
    summary: `${title} ${at + 1}`,
    dependsOn: [],
    ranges: hunks.map((hunk) => ({ hunk: HunkId.of(hunk) })),
    notes: hunks.map((hunk) => ({
      path: DIFF.fileOf(hunk)?.path ?? hunk,
      note: 'Why it changes',
    })),
  })),
});

const ready = (request = CheckRequest.of('npx tsc --noEmit', null)) => {
  const stack = ChangeStack.draft({
    id: ChangeStackId.of('stack-1'),
    runId: RunId.of('run-1'),
    taskId: null,
    replay: false,
    isSearch: false,
    workspaceId: WorkspaceId.of('workspace-1'),
    repository: null,
    base: null,
    diff: DIFF,
    facts: StackFacts.none(),
    request,
    now: NOW,
  }).propose(
    [
      cohort('Invitations', [['h1'], ['h2', 'h3']]),
      cohort('Docs', [['h5']]),
      cohort('Lockfile', [['h4']], 'incidental'),
    ],
    LATER,
  );

  stack.pullEvents();
  return stack;
};

const kinds = (stack: ChangeStack) =>
  stack.pullEvents().map((event) => event.kind);

describe('ChangeStack, on the check it requests', () => {
  it('carries what the station requested of it', () => {
    expect(ready().request?.command).toBe('npx tsc --noEmit');
    expect(ready(CheckRequest.of('npm test', 'npm ci')).request?.setup).toBe(
      'npm ci',
    );
  });

  it('checks the whole change, then each layer on top of the layers before it and the incidental changes', () => {
    const stack = ready();

    expect(
      stack.checkSteps(stack.entries()).map((step) => [step.id, step.hunks]),
    ).toEqual([
      ['whole', ['h1', 'h2', 'h3', 'h4', 'h5']],
      ['c1.l1', ['h4', 'h1']],
      ['c1.l2', ['h4', 'h1', 'h2', 'h3']],
      ['c2.l1', ['h4', 'h5']],
    ]);
  });

  it('names the layers a check can judge', () => {
    expect(ready().layers()).toEqual(['c1.l1', 'c1.l2', 'c2.l1']);
  });

  it('takes up reordering only once, and only once it is ready', () => {
    const requested = ready().requestReorder();

    expect(requested.reordering).toBe(true);
    expect(requested.hasPendingJob).toBe(true);
    expect(requested.requestReorder()).toBe(requested);
  });

  it('is not reordered before it is requested', () => {
    expect(() => ready().reordered([cohort('All', [['h1']])], LATER)).toThrow(
      InvalidChangeStackError,
    );
  });

  it('says it was reordered, and has no pending job any more', () => {
    const reordered = ready()
      .requestReorder()
      .reordered(
        [
          cohort('Invitations', [['h2'], ['h1', 'h3']]),
          cohort('Docs', [['h5']]),
          cohort('Lockfile', [['h4']], 'incidental'),
        ],
        LATER,
      );

    expect(reordered.reordering).toBe(false);
    expect(reordered.hasPendingJob).toBe(false);
    expect(kinds(reordered)).toEqual([
      'change-stack.reordered',
      'change-stack.ready',
    ]);
  });

  it('says reordering ended when reordering stops', () => {
    const ended = ready().requestReorder().stopReordering();

    expect(ended.reordering).toBe(false);
    expect(kinds(ended)).toEqual(['change-stack.reordering-ended']);
  });

  it('stops reordering once its job is dead-lettered', () => {
    const ended = ready().requestReorder().deadLetter(LATER);

    expect(ended.hasPendingJob).toBe(false);
    expect(kinds(ended)).toEqual(['change-stack.reordering-ended']);
  });

  it('records the events of every step it takes', () => {
    const stack = ChangeStack.draft({
      id: ChangeStackId.of('stack-3'),
      runId: RunId.of('run-1'),
      taskId: null,
      replay: false,
      isSearch: false,
      workspaceId: WorkspaceId.of('workspace-1'),
      repository: null,
      base: null,
      diff: DIFF,
      facts: StackFacts.none(),
      request: CheckRequest.of('npx tsc --noEmit', null),
      now: NOW,
    }).propose([cohort('All', [['h1', 'h2', 'h3', 'h4', 'h5']])], LATER);

    expect(kinds(stack)).toEqual([
      'change-stack.drafting-began',
      'change-stack.completed',
      'change-stack.ready',
    ]);
  });
});
