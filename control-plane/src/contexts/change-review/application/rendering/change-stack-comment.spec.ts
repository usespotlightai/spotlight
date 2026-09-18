import { ChangeStackComment } from '@change-review/application/rendering/change-stack-comment';
import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import {
  Diff,
  type DiffFile,
} from '@change-review/domain/value-objects/diff.vo';
import {
  StackCheck,
  WHOLE_STEP,
} from '@change-review/domain/value-objects/stack-check.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { HunkId, LayerId } from '@change-review/domain/value-objects/stack-ids';
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
      patch: '@@ -1 +1 @@\n-a\n+b',
    },
  ],
});

const NOW = new Date('2026-09-16T10:00:00Z');

const checked = () =>
  ChangeStack.draft({
    id: ChangeStackId.of('stack-1'),
    runId: RunId.of('run-1'),
    taskId: null,
    workspaceId: WorkspaceId.of('workspace-1'),
    repository: null,
    diff: Diff.of(['schema.ts', 'api.ts', 'package-lock.json'].map(changed)),
    facts: StackFacts.none(),
    check: StackCheck.named('npx tsc --noEmit'),
    now: NOW,
  })
    .propose(
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
    )
    .recordCheck(
      [
        { step: WHOLE_STEP, passed: true, output: '', tookMs: 1 },
        {
          step: LayerId.of('c1.l1'),
          passed: false,
          output: 'error',
          tookMs: 1,
        },
      ],
      NOW,
    )
    .keepLayers();

describe('ChangeStackComment', () => {
  it('links the stack and marks each layer that does not build', () => {
    const stack = checked();
    const body = ChangeStackComment.of(
      {
        cohorts: stack.cohorts,
        check: stack.check && {
          command: stack.check.command,
          state: stack.checkStateAt(NOW) ?? 'waiting',
          reason: stack.checkReasonAt(NOW),
          whole: stack.check.outcome?.whole ?? null,
          layers: stack.check.outcome?.layers ?? [],
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
