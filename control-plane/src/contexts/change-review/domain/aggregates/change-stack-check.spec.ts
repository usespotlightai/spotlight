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

describe('ChangeStack, on the check it asks for', () => {
  it('carries what the station asked of it', () => {
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
    const asked = ready().askedToReorder();

    expect(asked.reordering).toBe(true);
    expect(asked.owesWork).toBe(true);
    expect(asked.askedToReorder()).toBe(asked);
  });

  it('refuses to be reordered before it is asked', () => {
    expect(() => ready().reordered([cohort('All', [['h1']])], LATER)).toThrow(
      InvalidChangeStackError,
    );
  });

  it('says it was reordered, and stops owing the work', () => {
    const reordered = ready()
      .askedToReorder()
      .reordered(
        [
          cohort('Invitations', [['h2'], ['h1', 'h3']]),
          cohort('Docs', [['h5']]),
          cohort('Lockfile', [['h4']], 'incidental'),
        ],
        LATER,
      );

    expect(reordered.reordering).toBe(false);
    expect(reordered.owesWork).toBe(false);
    expect(kinds(reordered)).toEqual(['change-stack.reordered']);
  });

  it('says reordering ended where it is given up', () => {
    const kept = ready().askedToReorder().gaveUpReordering();

    expect(kept.reordering).toBe(false);
    expect(kinds(kept)).toEqual(['change-stack.reordering-ended']);
  });

  it('gives up reordering once it has been worked at for too long', () => {
    const kept = ready().askedToReorder().gaveUp(LATER);

    expect(kept.owesWork).toBe(false);
    expect(kinds(kept)).toEqual(['change-stack.reordering-ended']);
  });

  it('keeps the events of every step it takes', () => {
    const stack = ChangeStack.draft({
      id: ChangeStackId.of('stack-3'),
      runId: RunId.of('run-1'),
      taskId: null,
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
      'change-stack.settled',
    ]);
  });
});
