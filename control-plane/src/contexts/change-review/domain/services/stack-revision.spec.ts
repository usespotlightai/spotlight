import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import { revisionOf } from '@change-review/domain/services/stack-revision';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { WHOLE_STEP } from '@change-review/domain/value-objects/stack-check.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { HunkId, LayerId } from '@change-review/domain/value-objects/stack-ids';
import { GitDiffReader } from '@change-review/infrastructure/change-stacks/git-diff.reader';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
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

const CHECKER = RunnerId.of('checker_1');

const stack = () =>
  ChangeStack.draft({
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
    request: CheckRequest.of('npm test', null),
    now: NOW,
  }).propose(
    [
      {
        kind: 'change',
        title: 'Labels',
        intent: 'Labels',
        layers: [['h1'], ['h2']].map((hunks, at) => ({
          title: `Layer ${at + 1}`,
          summary: 'A layer',
          dependsOn: [],
          ranges: hunks.map((hunk) => ({ hunk: HunkId.of(hunk) })),
          notes: hunks.map((hunk) => ({
            path: DIFF.fileOf(hunk)?.path ?? hunk,
            note: 'Why it changes',
          })),
        })),
      },
    ],
    NOW,
  );

const checkOf = (built = stack()) =>
  StackCheck.begin({
    stackId: built.id,
    runId: built.runId,
    taskId: null,
    replay: false,
    workspaceId: built.workspaceId,
    request: CheckRequest.of('npx tsc --noEmit', null),
    entries: built.entries(),
    now: NOW,
  })
    .claimedFor(CHECKER, RunnerTerms.none(), NOW)
    .recordResult(
      CHECKER,
      { steps: built.checkSteps(built.entries()), layers: built.layers() },
      [
        { step: WHOLE_STEP, passed: true, output: '', tookMs: 1 },
        {
          step: LayerId.of('c1.l1'),
          passed: false,
          output:
            "src/presentation/http/mappers/task.http.mapper.spec.ts(5,7): error TS2741: Property 'labels' is missing",
          tookMs: 1,
        },
      ],
      NOW,
    );

describe('revisionOf', () => {
  it('shows the state of the stack, what failed, and where the files its errors name sit', () => {
    expect(revisionOf(stack(), checkOf())).toEqual({
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
              hunks: [{ hunk: HunkId.of('h2'), layer: 1 }],
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
      replay: false,
      isSearch: false,
      workspaceId: WorkspaceId.of('workspace-1'),
      repository: null,
      base: null,
      diff: DIFF,
      facts: StackFacts.none(),
      request: null,
      now: NOW,
    });

    expect(
      revisionOf(
        built,
        StackCheck.begin({
          stackId: built.id,
          runId: built.runId,
          taskId: null,
          replay: false,
          workspaceId: built.workspaceId,
          request: CheckRequest.of('npx tsc --noEmit', null),
          entries: [],
          now: NOW,
        }),
      ),
    ).toBeNull();
  });
});
