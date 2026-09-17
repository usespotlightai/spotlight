import type {
  DiffFacts,
  HunkFacts,
  HunkLink,
} from '@change-review/domain/services/diff-facts';
import {
  derivedDependencies,
  factProblems,
} from '@change-review/domain/services/fact-rules';
import type {
  ProposedCohort,
  ProposedLayer,
} from '@change-review/domain/value-objects/stack-cohort.vo';
import { describe, expect, it } from 'vitest';

const hunk = (id: string, over: Partial<HunkFacts> = {}): HunkFacts => ({
  hunk: id,
  path: `src/${id}.ts`,
  fileClass: 'source',
  incidental: false,
  renamed: false,
  moved: false,
  linkable: true,
  defines: [],
  outside: [],
  ...over,
});

const layer = (hunks: string[]): ProposedLayer => ({
  title: 'A layer',
  summary: 'A layer',
  dependsOn: [],
  ranges: hunks.map((each) => ({ hunk: each })),
  notes: [],
});

const cohort = (
  layers: string[][],
  over: Partial<ProposedCohort> = {},
): ProposedCohort => ({
  kind: 'change',
  title: 'A cohort',
  intent: 'A cohort',
  layers: layers.map(layer),
  ...over,
});

const facts = (hunks: HunkFacts[], links: HunkLink[] = []): DiffFacts => ({
  hunks,
  links,
  imports: [],
});

const messagesOf = (...args: Parameters<typeof factProblems>) =>
  factProblems(...args).map((each) => each.message);

describe('factProblems', () => {
  it('keeps a test in the same layer as the code it covers', () => {
    const covered = facts(
      [hunk('h1'), hunk('h2', { fileClass: 'test' })],
      [{ kind: 'tests', from: 'h2', to: 'h1', because: ['invite.ts'] }],
    );

    expect(messagesOf([cohort([['h1', 'h2']])], covered)).toEqual([]);
    expect(messagesOf([cohort([['h1'], ['h2']])], covered)).toEqual([
      'h2 tests invite.ts, so it belongs in layer 1 with the code it covers',
    ]);
  });

  it('keeps moved code in one layer', () => {
    const moved = facts(
      [hunk('h1'), hunk('h2')],
      [{ kind: 'moves', from: 'h2', to: 'h1', because: ['a → b'] }],
    );

    expect(messagesOf([cohort([['h1'], ['h2']])], moved)).toEqual([
      'h2 is code moved from h1, so they belong in the same layer',
    ]);
  });

  it('puts a migration in the first layer of its cohort', () => {
    const migrating = facts(
      [hunk('h1'), hunk('h2', { fileClass: 'migration', linkable: false })],
      [],
    );

    expect(
      messagesOf(
        [cohort([['h1'], ['h2']], { joinedBecause: 'One feature' })],
        migrating,
      ),
    ).toEqual([
      'h2 is a migration, so it belongs in layer 1 of its cohort, not layer 2',
    ]);
  });

  it('questions a cohort that joins changes nothing connects, unless it says why', () => {
    const unlinked = facts(
      [hunk('h1'), hunk('h2'), hunk('h3')],
      [{ kind: 'uses', from: 'h2', to: 'h1', because: ['Invite'] }],
    );

    expect(messagesOf([cohort([['h1', 'h2', 'h3']])], unlinked)).toEqual([
      'cohort 1 joins changes the code does not connect (h1, h2 | h3) without saying why',
    ]);
    expect(
      messagesOf(
        [cohort([['h1', 'h2', 'h3']], { joinedBecause: 'One feature' })],
        unlinked,
      ),
    ).toEqual([]);
  });

  it('leaves hunks it cannot read out of the connection check', () => {
    const unread = facts([
      hunk('h1'),
      hunk('h2', { path: 'styles/app.css', linkable: false }),
    ]);

    expect(messagesOf([cohort([['h1', 'h2']])], unread)).toEqual([]);
  });
});

describe('derivedDependencies', () => {
  it('takes what a layer depends on from uses and tests, not moves', () => {
    const derived = derivedDependencies(
      [cohort([['h1'], ['h2', 'h3']])],
      [
        { kind: 'uses', from: 'h2', to: 'h1', because: ['Invite'] },
        { kind: 'moves', from: 'h3', to: 'h1', because: ['a → b'] },
      ],
    );

    expect([...(derived.get('0.1') ?? new Map()).entries()]).toEqual([
      [1, new Set(['Invite'])],
    ]);
  });
});
