import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { GitDiffReader } from '@change-review/infrastructure/change-stacks/git-diff.reader';
import { revisionOf } from '@change-review/infrastructure/change-stacks/stack-revision';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const changed = (path: string) =>
  [
    `diff --git a/${path} b/${path}`,
    `--- a/${path}`,
    `+++ b/${path}`,
    '@@ -1 +1 @@',
    '-before',
    '+after',
  ].join('\n');

const { diff: DIFF } = new GitDiffReader().read(
  [
    'control-plane/src/application/dto/task.dto.ts',
    'control-plane/src/presentation/http/mappers/task.http.mapper.spec.ts',
  ]
    .map(changed)
    .join('\n'),
);

const NOW = new Date('2026-09-16T10:00:00Z');

const stack = () =>
  ChangeStack.draft({
    id: ChangeStackId.of('stack-1'),
    runId: RunId.of('run-1'),
    taskId: null,
    workspaceId: WorkspaceId.of('workspace-1'),
    repository: null,
    diff: DIFF,
    facts: StackFacts.none(),
    check: 'npx tsc --noEmit',
    now: NOW,
  })
    .propose(
      [
        {
          kind: 'change',
          title: 'Labels',
          intent: 'Labels',
          layers: [['h1'], ['h2']].map((hunks, at) => ({
            title: `Layer ${at + 1}`,
            summary: 'A layer',
            dependsOn: [],
            ranges: hunks.map((hunk) => ({ hunk })),
            notes: hunks.map((hunk) => ({
              path: DIFF.fileOf(hunk)?.path ?? hunk,
              note: 'Why it changes',
            })),
          })),
        },
      ],
      NOW,
      false,
    )
    .recordCheck(
      [
        { step: 'whole', passed: true, output: '', tookMs: 1 },
        {
          step: 'c1.l1',
          passed: false,
          output:
            "src/presentation/http/mappers/task.http.mapper.spec.ts(5,7): error TS2741: Property 'labels' is missing",
          tookMs: 1,
        },
      ],
      NOW,
    );

describe('revisionOf', () => {
  it('gives how the stack stood, what failed, and where the files its errors name sit', () => {
    expect(revisionOf(stack())).toEqual({
      command: 'npx tsc --noEmit',
      stack: [
        {
          title: 'Labels',
          layers: [
            { title: 'Layer 1', hunks: ['h1'] },
            { title: 'Layer 2', hunks: ['h2'] },
          ],
        },
      ],
      failed: [
        {
          cohort: 0,
          layer: 0,
          title: 'Layer 1',
          output:
            "src/presentation/http/mappers/task.http.mapper.spec.ts(5,7): error TS2741: Property 'labels' is missing",
          named: [
            {
              path: 'control-plane/src/presentation/http/mappers/task.http.mapper.spec.ts',
              hunks: [{ hunk: 'h2', layer: 1 }],
            },
          ],
        },
      ],
    });
  });

  it('has nothing to revise in a stack that was not checked', () => {
    const built = ChangeStack.draft({
      id: ChangeStackId.of('stack-2'),
      runId: RunId.of('run-1'),
      taskId: null,
      workspaceId: WorkspaceId.of('workspace-1'),
      repository: null,
      diff: DIFF,
      facts: StackFacts.none(),
      now: NOW,
    });

    expect(revisionOf(built)).toBeNull();
  });
});
