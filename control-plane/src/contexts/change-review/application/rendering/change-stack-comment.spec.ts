import { ChangeStackComment } from '@change-review/application/rendering/change-stack-comment';
import { checkReasonOf } from '@change-review/application/rendering/check-reason';
import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import {
  Diff,
  type DiffFile,
} from '@change-review/domain/value-objects/diff.vo';
import { WHOLE_STEP } from '@change-review/domain/value-objects/stack-check.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { HunkId, LayerId } from '@change-review/domain/value-objects/stack-ids';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
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
      patch: '@@ -1 +1 @@\n-a\n+b',
    },
  ],
});

const NOW = new Date('2026-09-16T10:00:00Z');

const CHECKER = RunnerId.of('checker_1');

const checked = () =>
  ChangeStack.draft({
    id: ChangeStackId.of('stack-1'),
    runId: RunId.of('run-1'),
    taskId: null,
    replay: false,
    workspaceId: WorkspaceId.of('workspace-1'),
    repository: null,
    base: null,
    diff: Diff.of(['schema.ts', 'api.ts', 'package-lock.json'].map(changed)),
    facts: StackFacts.none(),
    request: CheckRequest.of('npm test', null),
    now: NOW,
  }).propose(
    [
      {
        kind: 'change',
        title: 'Task labels',
        intent: 'Labels',
        layers: [['h1'], ['h2']].map((hunks, at) => ({
          title: at === 0 ? 'Add the label table' : 'Add the label API',
          summary: 'A layer',
          dependsOn: [],
          ranges: hunks.map((hunk) => ({ hunk: HunkId.of(hunk) })),
          notes: [
            {
              path: at === 0 ? 'schema.ts' : 'api.ts',
              note: 'Why it changes',
            },
          ],
        })),
      },
      {
        kind: 'incidental',
        title: 'Update lockfiles',
        intent: 'Incidental',
        layers: [
          {
            title: 'Update lockfiles',
            summary: 'Incidental',
            dependsOn: [],
            ranges: [{ hunk: HunkId.of('h3') }],
            notes: [],
          },
        ],
      },
    ],
    NOW,
  );

describe('ChangeStackComment', () => {
  it('links the stack and marks each layer that does not build', () => {
    const stack = checked();
    const check = StackCheck.begin({
      stackId: stack.id,
      runId: stack.runId,
      taskId: null,
      replay: false,
      workspaceId: stack.workspaceId,
      request: CheckRequest.of('npx tsc --noEmit', null),
      entries: stack.entries(),
      now: NOW,
    })
      .claimedFor(CHECKER, RunnerTerms.none(), NOW)
      .recorded(
        CHECKER,
        { steps: stack.checkSteps(stack.entries()), layers: stack.layers() },
        [
          { step: WHOLE_STEP, passed: true, output: '', tookMs: 1 },
          {
            step: LayerId.of('c1.l1'),
            passed: false,
            output: 'does not build',
            tookMs: 1,
          },
        ],
        NOW,
      )
      .keptLayers();
    const body = ChangeStackComment.of(
      {
        cohorts: stack.cohorts,
        check: {
          command: check.request.command,
          state: check.stateAt(NOW),
          reason: checkReasonOf({
            skipped: check.skippedAt(NOW),
            wholeFailed: check.wholeFailed,
          }),
          whole: check.outcome?.whole ?? null,
          layers: check.outcome?.layers ?? [],
        },
      },
      'https://app.example/w/acme/team/t1/runs/run-1/changes',
    );

    expect(body).toContain(
      '[open the change stack in Spotlight](https://app.example/w/acme/team/t1/runs/run-1/changes)',
    );
    expect(body).toContain(
      '**Task labels**\n1. Add the label table (1 change) · does not build\n2. Add the label API (1 change)',
    );
    expect(body).toContain('Set aside as incidental: Update lockfiles.');
    expect(body).toContain('checked on its own with `npx tsc --noEmit`');
  });
});
