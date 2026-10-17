import { RecheckReplayChanges } from '@change-review/application/services/recheck-replay-changes.service';
import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckClaim } from '@change-review/domain/value-objects/check-claim.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import type { CheckPhase } from '@change-review/domain/value-objects/stack-check.vo';
import {
  nobodyChecked,
  WHOLE_STEP,
} from '@change-review/domain/value-objects/stack-check.vo';
import { Provisioning } from '@shared-kernel/domain/value-objects/provisioning.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-03T10:00:00Z');

const RUN = RunId.of('replay-1');

const checkOf = (
  id: string,
  phase: Exclude<CheckPhase, 'reordering'>,
  over: { replay?: boolean; recheck?: boolean } = {},
) =>
  StackCheck.rehydrate({
    stackId: ChangeStackId.of(id),
    runId: RUN,
    taskId: null,
    replay: over.replay ?? true,
    recheck: over.recheck ?? false,
    workspaceId: WorkspaceId.of('ws-1'),
    request: CheckRequest.of('npm test', null),
    phase,
    entries: [],
    rounds: 0,
    outcome:
      phase === 'waiting'
        ? null
        : {
            state: phase === 'checked' ? 'checked' : 'skipped',
            skip: phase === 'checked' ? null : nobodyChecked(),
            whole:
              phase === 'checked'
                ? { step: WHOLE_STEP, passed: true, output: '', tookMs: 1 }
                : null,
            layers: [],
            checkedAt: NOW,
          },
    claim: CheckClaim.none(),
    waitingSince: NOW,
    reservation: null,
    provisioning: Provisioning.none(),
    version: 0,
  });

const rechecking = (stored: StackCheck[]) => {
  const added: StackCheck[] = [];
  const all = () => [...stored, ...added];
  const checks = {
    ofRun: async () => all(),
    find: async (stackId: { value: string }, recheck: boolean) =>
      all().find(
        (each) =>
          each.stackId.value === stackId.value && each.recheck === recheck,
      ) ?? null,
    add: async (check: StackCheck) => {
      added.push(check);
    },
  } as unknown as StackCheckRepository;

  return {
    added,
    service: new RecheckReplayChanges(
      checks,
      { inTransaction: (work) => work() },
      { now: () => NOW, sleep: async () => undefined },
    ),
  };
};

describe('RecheckReplayChanges', () => {
  it('names the stacks of a replay run whose first check passed or failed', async () => {
    const { service } = rechecking([
      checkOf('passed', 'checked'),
      checkOf('waiting', 'waiting'),
      checkOf('skipped', 'skipped'),
      checkOf('task', 'checked', { replay: false }),
    ]);

    expect(await service.recheckable(RUN.value)).toEqual(['passed']);
  });

  it('checks one stack again, once however often it is asked', async () => {
    const { added, service } = rechecking([checkOf('passed', 'checked')]);

    await service.recheck(RUN.value, 'passed');
    await service.recheck(RUN.value, 'passed');

    expect(added.map((each) => [each.stackId.value, each.recheck])).toEqual([
      ['passed', true],
    ]);
  });

  it('checks nothing again that nobody checked, or that is another run’s', async () => {
    const { added, service } = rechecking([
      checkOf('skipped', 'skipped'),
      checkOf('passed', 'checked'),
    ]);

    await service.recheck(RUN.value, 'skipped');
    await service.recheck('replay-2', 'passed');
    await service.recheck(RUN.value, 'missing');

    expect(added).toEqual([]);
  });
});
