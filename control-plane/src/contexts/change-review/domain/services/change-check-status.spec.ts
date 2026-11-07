import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import { changeCheckStatusOf } from '@change-review/domain/services/change-check-status';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckClaim } from '@change-review/domain/value-objects/check-claim.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { Diff } from '@change-review/domain/value-objects/diff.vo';
import type { CheckOutcome } from '@change-review/domain/value-objects/stack-check.vo';
import {
  WAITING_LIMIT_MS,
  WHOLE_STEP,
} from '@change-review/domain/value-objects/stack-check.vo';
import { StackCheckId } from '@change-review/domain/value-objects/stack-check-id.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';
import { Provisioning } from '@shared-kernel/domain/value-objects/provisioning.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
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
  state: 'ready' | 'failed' | 'generating' = 'ready',
) => {
  const generating = ChangeStack.startGeneration({
    id: ChangeStackId.of(id),
    runId: RUN,
    taskId: null,
    teamOfRun: TeamId.of('team_1'),
    replay: true,
    isSearch: false,
    workspaceId: WorkspaceId.of('ws-1'),
    repository: id,
    base: null,
    diff: DIFF,
    facts: StackFacts.of({ hunks: [], links: [], imports: [] }),
    request,
    now: NOW,
  });

  if (state === 'generating') {
    return generating;
  }

  return state === 'failed'
    ? generating.deadLetter(NOW)
    : generating.propose(
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
                hunks: [{ hunk: HunkId.of('h1') }],
                notes: [{ path: 'api.ts', note: 'Drains' }],
                questions: [],
              },
            ],
          },
        ],
        NOW,
      );
};

const checkOf = (
  id: string,
  outcome: CheckOutcome | null,
  since = NOW,
  recheck = false,
) =>
  StackCheck.rehydrate({
    id: StackCheckId.of(ChangeStackId.of(id), recheck),
    runId: RUN,
    taskId: null,
    teamId: null,
    replay: true,
    workspaceId: WorkspaceId.of('ws-1'),
    request: CheckRequest.of('npm test', null),
    status: outcome?.status ?? 'waiting',
    entries: [],
    redraftCount: 0,
    outcome,
    claim: CheckClaim.none(),
    waitingSince: since,
    reservation: null,
    provisioning: Provisioning.none(),
    version: 0,
  });

const checked = (passed: boolean): CheckOutcome => ({
  status: 'checked',
  skip: null,
  whole: { step: WHOLE_STEP, passed, output: '', durationMs: 1 },
  layers: [],
  checkedAt: NOW,
});

const statusOf = (stack: ChangeStack, check: StackCheck | null, now = NOW) =>
  changeCheckStatusOf(
    { state: stack.state, requestsCheck: stack.request !== null },
    check,
    now,
  );

const REQUEST = CheckRequest.of('npm test', null);

describe('the check status of a change', () => {
  it('follows the stack until it is generated with a check, then its check', () => {
    expect([
      statusOf(stackOf('generating', REQUEST, 'generating'), null),
      statusOf(stackOf('not-generated', REQUEST, 'failed'), null),
      statusOf(stackOf('unchecked', null), null),
      statusOf(stackOf('checking', REQUEST), null),
      statusOf(stackOf('waiting', REQUEST), checkOf('waiting', null)),
      statusOf(stackOf('passed', REQUEST), checkOf('passed', checked(true))),
      statusOf(stackOf('failed', REQUEST), checkOf('failed', checked(false))),
    ]).toEqual([
      'generating',
      'not-generated',
      'unchecked',
      'checking',
      'checking',
      'passed',
      'failed',
    ]);
  });

  it('is skipped once its check waited too long', () => {
    expect(
      statusOf(
        stackOf('expired', REQUEST),
        checkOf('expired', null),
        new Date(NOW.getTime() + WAITING_LIMIT_MS + 1),
      ),
    ).toBe('skipped');
  });

  it('takes a recheck as the check it shows', () => {
    expect(
      statusOf(
        stackOf('flipped', REQUEST),
        checkOf('flipped', checked(false), NOW, true),
      ),
    ).toBe('failed');
  });
});
