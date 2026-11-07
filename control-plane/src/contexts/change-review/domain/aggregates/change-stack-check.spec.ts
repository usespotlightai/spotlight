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
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
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
    hunks: hunks.map((hunk) => ({ hunk: HunkId.of(hunk) })),
    notes: hunks.map((hunk) => ({
      path: DIFF.fileOf(hunk)?.path ?? hunk,
      note: 'Why it changes',
    })),
    questions: [],
  })),
});

const ready = (
  request = CheckRequest.of('npx tsc --noEmit', null),
  facts = StackFacts.of({ hunks: [], links: [], imports: [] }),
) => {
  const stack = ChangeStack.startGeneration({
    id: ChangeStackId.of('stack-1'),
    runId: RunId.of('run-1'),
    taskId: null,
    teamOfRun: TeamId.of('team_1'),
    trial: false,
    checkouts: 1,
    workspaceId: WorkspaceId.of('workspace-1'),
    repository: null,
    base: null,
    diff: DIFF,
    facts,
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

  it('takes up redrafting only once, and only once it is ready', () => {
    const requested = ready().requestRedraft();

    expect(requested.redrafting).toBe(true);
    expect(requested.hasPendingJob).toBe(true);
    expect(requested.requestRedraft()).toBe(requested);
  });

  it('is not redrafted before it is requested', () => {
    expect(() => ready().redrafted([cohort('All', [['h1']])], LATER)).toThrow(
      InvalidChangeStackError,
    );
  });

  it('says it was redrafted, and has no pending job any more', () => {
    const redrafted = ready()
      .requestRedraft()
      .redrafted(
        [
          cohort('Invitations', [['h2'], ['h1', 'h3']]),
          cohort('Docs', [['h5']]),
          cohort('Lockfile', [['h4']], 'incidental'),
        ],
        LATER,
      );

    expect(redrafted.redrafting).toBe(false);
    expect(redrafted.hasPendingJob).toBe(false);
    expect(kinds(redrafted)).toEqual([
      'change-stack.redrafted',
      'change-stack.became-ready',
    ]);
  });

  describe('with moved code', () => {
    const moving = StackFacts.of({
      hunks: [],
      links: [
        {
          kind: 'moves',
          from: HunkId.of('h2'),
          to: HunkId.of('h1'),
          because: ['schema.ts → api.ts'],
        },
      ],
      imports: [],
    });
    const redraftOf = (proposed: ProposedCohort[]) =>
      ready(undefined, moving).requestRedraft().redrafted(proposed, LATER);

    it('puts moved code together in the layer that keeps every layer', () => {
      const redrafted = redraftOf([
        cohort('Invitations', [['h1', 'h3'], ['h2']]),
        cohort('Docs', [['h5']]),
        cohort('Lockfile', [['h4']], 'incidental'),
      ]);

      expect(redrafted.layers()).toEqual(['c1.l1', 'c1.l2', 'c2.l1']);
      expect(
        redrafted.cohorts[0]?.layers.map((each) =>
          each.hunks.map((entry) => entry.hunk),
        ),
      ).toEqual([['h3'], ['h2', 'h1']]);
    });

    it('refuses a redraft that only puts moved code together by joining layers', () => {
      expect(() =>
        redraftOf([
          cohort('Invitations', [['h1'], ['h2']]),
          cohort('Docs', [['h3', 'h5']]),
          cohort('Lockfile', [['h4']], 'incidental'),
        ]),
      ).toThrow('h2 is code moved from h1, so they belong in the same layer');
    });
  });

  it('says redrafting ended when redrafting stops', () => {
    const ended = ready().requestRedraft().stopRedrafting();

    expect(ended.redrafting).toBe(false);
    expect(kinds(ended)).toEqual(['change-stack.redrafting-ended']);
  });

  it('stops redrafting once its job is dead-lettered', () => {
    const ended = ready().requestRedraft().deadLetter(LATER);

    expect(ended.hasPendingJob).toBe(false);
    expect(kinds(ended)).toEqual(['change-stack.redrafting-ended']);
  });

  it('records the events of every step it takes', () => {
    const stack = ChangeStack.startGeneration({
      id: ChangeStackId.of('stack-3'),
      runId: RunId.of('run-1'),
      taskId: null,
      teamOfRun: TeamId.of('team_1'),
      trial: false,
      checkouts: 1,
      workspaceId: WorkspaceId.of('workspace-1'),
      repository: null,
      base: null,
      diff: DIFF,
      facts: StackFacts.of({ hunks: [], links: [], imports: [] }),
      request: CheckRequest.of('npx tsc --noEmit', null),
      now: NOW,
    }).propose([cohort('All', [['h1', 'h2', 'h3', 'h4', 'h5']])], LATER);

    expect(kinds(stack)).toEqual([
      'change-stack.completed',
      'change-stack.became-ready',
    ]);
  });
});
