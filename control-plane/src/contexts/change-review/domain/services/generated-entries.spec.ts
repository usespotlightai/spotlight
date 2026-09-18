import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { generatedEntries } from '@change-review/domain/services/generated-entries';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import {
  Diff,
  type DiffFile,
} from '@change-review/domain/value-objects/diff.vo';
import { StackCheck } from '@change-review/domain/value-objects/stack-check.vo';
import type { ProposedCohort } from '@change-review/domain/value-objects/stack-cohort.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const PATHS = [
  'control-plane/src/label.controller.ts',
  'web/src/lib/api/types.gen.ts',
  'web/src/lib/api/index.ts',
  'web/src/hooks/useLabels.ts',
  'web/src/routes/Board.tsx',
  'control-plane/drizzle/meta/_journal.json',
];

const GENERATED = new Set([
  'web/src/lib/api/types.gen.ts',
  'control-plane/drizzle/meta/_journal.json',
]);

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

const DIFF = Diff.of(PATHS.map(changed));

const IMPORTS = [
  { from: 'web/src/lib/api/index.ts', to: 'web/src/lib/api/types.gen.ts' },
  { from: 'web/src/hooks/useLabels.ts', to: 'web/src/lib/api/index.ts' },
  { from: 'web/src/routes/Board.tsx', to: 'web/src/hooks/useLabels.ts' },
];

const COHORTS: ProposedCohort[] = [
  {
    kind: 'change',
    title: 'Labels',
    intent: 'Labels',
    joinedBecause: 'One feature',
    layers: [['h1'], ['h3', 'h4'], ['h5']].map((hunks, at) => ({
      title: `Layer ${at + 1}`,
      summary: `Layer ${at + 1}`,
      dependsOn: [],
      ranges: hunks.map((hunk) => ({ hunk: HunkId.of(hunk) })),
      notes: hunks.map((hunk) => ({
        path: DIFF.fileOf(hunk)?.path ?? hunk,
        note: 'Why it changes',
      })),
    })),
  },
];

const factsWith = (imports: typeof IMPORTS) =>
  StackFacts.of({
    hunks: PATHS.map((path, at) => {
      const generated = GENERATED.has(path);

      return {
        hunk: HunkId.at(at + 1),
        path,
        fileClass: generated ? 'generated' : 'source',
        incidental: generated,
        renamed: false,
        moved: false,
        linkable: !generated,
        defines: [],
        outside: [],
      };
    }),
    links: [],
    imports,
  });

const facts = factsWith(IMPORTS);

const ready = () =>
  ChangeStack.draft({
    id: ChangeStackId.of('stack-1'),
    runId: RunId.of('run-1'),
    taskId: null,
    workspaceId: WorkspaceId.of('workspace-1'),
    repository: null,
    diff: DIFF,
    facts,
    check: StackCheck.named('npx tsc -b'),
    now: new Date('2026-09-16T10:00:00Z'),
  }).propose(COHORTS, new Date('2026-09-16T10:01:00Z'));

describe('generatedEntries', () => {
  it('lets a generated file in with the earliest layer that reaches it through imports', () => {
    expect(generatedEntries(DIFF, ready().cohorts, facts)).toEqual([
      { hunk: HunkId.of('h2'), layer: 'c1.l2' },
    ]);
  });

  it('leaves out a generated file nothing imports', () => {
    expect(generatedEntries(DIFF, ready().cohorts, factsWith([]))).toEqual([]);
  });

  it('checks each layer with only the generated files it reaches, and the whole change with all of them', () => {
    expect(ready().checkSteps()).toEqual([
      { id: 'whole', hunks: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] },
      { id: 'c1.l1', hunks: ['h1'] },
      { id: 'c1.l2', hunks: ['h1', 'h2', 'h3', 'h4'] },
      { id: 'c1.l3', hunks: ['h1', 'h2', 'h3', 'h4', 'h5'] },
    ]);
  });
});
