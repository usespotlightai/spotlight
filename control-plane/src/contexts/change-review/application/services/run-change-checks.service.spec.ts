import {
  RunChangeChecks,
  WHOLE_CHANGE,
} from '@change-review/application/services/run-change-checks.service';
import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckClaim } from '@change-review/domain/value-objects/check-claim.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { Diff } from '@change-review/domain/value-objects/diff.vo';
import type { CheckOutcome } from '@change-review/domain/value-objects/stack-check.vo';
import {
  WAITING_LIMIT_MS,
  WHOLE_STEP,
} from '@change-review/domain/value-objects/stack-check.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';
import { Provisioning } from '@shared-kernel/domain/value-objects/provisioning.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-02T10:00:00Z');

const RUN = RunId.of('replay-1');

const DIFF = Diff.of([
  {
    path: 'api.ts',
    previousPath: null,
    status: 'modified',
    binary: false,
    hunks: [
      {
        id: HunkId.of('h1'),
        oldStart: 1,
        oldLines: 1,
        newStart: 1,
        newLines: 1,
        patch: '@@ -1 +1 @@\n-a\n+b',
      },
    ],
  },
]);

const stackOf = (
  id: string,
  request: CheckRequest | null,
  settled: 'ready' | 'failed' | 'drafting' = 'ready',
) => {
  const drafting = ChangeStack.draft({
    id: ChangeStackId.of(id),
    runId: RUN,
    taskId: null,
    replay: true,
    isSearch: false,
    workspaceId: WorkspaceId.of('ws-1'),
    repository: id,
    base: null,
    diff: DIFF,
    facts: StackFacts.none(),
    request,
    now: NOW,
  });

  if (settled === 'drafting') {
    return drafting;
  }

  return settled === 'failed'
    ? drafting.fail('No.', NOW)
    : drafting.propose(
        [
          {
            kind: 'change',
            title: 'Drain',
            intent: 'Drain',
            layers: [
              {
                title: 'Drain in order',
                summary: 'Drain',
                dependsOn: [],
                ranges: [{ hunk: HunkId.of('h1') }],
                notes: [{ path: 'api.ts', note: 'Drains' }],
              },
            ],
          },
        ],
        NOW,
      );
};

const checkOf = (id: string, outcome: CheckOutcome | null, since = NOW) =>
  StackCheck.rehydrate({
    stackId: ChangeStackId.of(id),
    runId: RUN,
    taskId: null,
    replay: true,
    workspaceId: WorkspaceId.of('ws-1'),
    request: CheckRequest.of('npm test', null),
    phase: outcome?.state ?? 'waiting',
    entries: [],
    rounds: 0,
    outcome,
    claim: CheckClaim.none(),
    waitingSince: since,
    reservation: null,
    provisioning: Provisioning.none(),
    version: 0,
  });

const checked = (passed: boolean): CheckOutcome => ({
  state: 'checked',
  skip: null,
  whole: { step: WHOLE_STEP, passed, output: '', tookMs: 1 },
  layers: [],
  checkedAt: NOW,
});

const reading = (
  stacks: readonly ChangeStack[],
  checks: readonly StackCheck[],
  now = NOW,
) =>
  new RunChangeChecks(
    { ofRun: async () => stacks } as unknown as ChangeStackRepository,
    { ofRun: async () => checks } as unknown as StackCheckRepository,
    { now: () => now, sleep: async () => undefined },
  ).ofRun(RUN.value);

const REQUEST = CheckRequest.of('npm test', null);

describe('RunChangeChecks', () => {
  it('says where each of a run’s stacks stands, by its repository', async () => {
    const standing = await reading(
      [
        stackOf('drafting', REQUEST, 'drafting'),
        stackOf('undrafted', REQUEST, 'failed'),
        stackOf('unchecked', null),
        stackOf('checking', REQUEST),
        stackOf('passed', REQUEST),
        stackOf('failed', REQUEST),
      ],
      [checkOf('passed', checked(true)), checkOf('failed', checked(false))],
    );

    expect(
      standing.map((each) => [each.repository, each.state, each.failedAt]),
    ).toEqual([
      ['drafting', 'drafting', []],
      ['undrafted', 'undrafted', []],
      ['unchecked', 'unchecked', []],
      ['checking', 'checking', []],
      ['passed', 'passed', []],
      ['failed', 'failed', [WHOLE_CHANGE]],
    ]);
  });

  it('says nobody checked a stack whose check waited too long', async () => {
    const [standing] = await reading(
      [stackOf('lapsed', REQUEST)],
      [checkOf('lapsed', null)],
      new Date(NOW.getTime() + WAITING_LIMIT_MS + 1),
    );

    expect(standing).toMatchObject({
      state: 'skipped',
      skip: 'nobody-checked',
    });
  });
});
