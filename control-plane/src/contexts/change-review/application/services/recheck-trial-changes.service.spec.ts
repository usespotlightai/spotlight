import { RecheckTrialChanges } from '@change-review/application/services/recheck-trial-changes.service';
import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckClaim } from '@change-review/domain/value-objects/check-claim.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { StackCheckId } from '@change-review/domain/value-objects/stack-check-id.vo';
import type { StackCheckStatus } from '@change-review/domain/value-objects/stack-check.vo';
import {
  queueTimeout,
  WHOLE_STEP,
} from '@change-review/domain/value-objects/stack-check.vo';
import { CheckWorkId } from '@shared-kernel/domain/value-objects/check-work-id.vo';
import { Provisioning } from '@shared-kernel/domain/value-objects/provisioning.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-03T10:00:00Z');

const RUN = RunId.of('replay-1');

const checkOf = (
  id: string,
  status: Exclude<StackCheckStatus, 'redrafting'>,
  over: { trial?: boolean; recheck?: boolean } = {},
) =>
  StackCheck.rehydrate({
    id: StackCheckId.of(ChangeStackId.of(id), over.recheck ?? false),
    runId: RUN,
    taskId: null,
    teamId: TeamId.of('team_1'),
    trial: over.trial ?? true,
    workspaceId: WorkspaceId.of('ws-1'),
    request: CheckRequest.of('npm test', null),
    status,
    entries: [],
    redraftCount: 0,
    outcome:
      status === 'waiting'
        ? null
        : {
            status: status === 'checked' ? 'checked' : 'skipped',
            skip: status === 'checked' ? null : queueTimeout(),
            whole:
              status === 'checked'
                ? { step: WHOLE_STEP, passed: true, output: '', durationMs: 1 }
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
    find: async (id: StackCheckId) =>
      all().find((each) => each.id.equals(id)) ?? null,
    add: async (check: StackCheck) => {
      added.push(check);
    },
  } as unknown as StackCheckRepository;

  return {
    added,
    service: new RecheckTrialChanges(
      checks,
      { inTransaction: (work) => work() },
      { now: () => NOW, sleep: async () => undefined },
    ),
  };
};

describe('RecheckTrialChanges', () => {
  it('names the stacks of a trial run whose first check passed or failed', async () => {
    const { service } = rechecking([
      checkOf('passed', 'checked'),
      checkOf('waiting', 'waiting'),
      checkOf('skipped', 'skipped'),
      checkOf('task', 'checked', { trial: false }),
    ]);

    expect(await service.recheckable(RUN)).toEqual([CheckWorkId.of('passed')]);
  });

  it('checks one stack again, once however often it is requested', async () => {
    const { added, service } = rechecking([checkOf('passed', 'checked')]);

    await service.recheck(RUN, CheckWorkId.of('passed'));
    await service.recheck(RUN, CheckWorkId.of('passed'));

    expect(added.map((each) => [each.stackId.value, each.recheck])).toEqual([
      ['passed', true],
    ]);
  });

  it('checks nothing again that no runner checked, or that is another run’s', async () => {
    const { added, service } = rechecking([
      checkOf('skipped', 'skipped'),
      checkOf('passed', 'checked'),
    ]);

    await service.recheck(RUN, CheckWorkId.of('skipped'));
    await service.recheck(RunId.of('replay-2'), CheckWorkId.of('passed'));
    await service.recheck(RUN, CheckWorkId.of('missing'));

    expect(added).toEqual([]);
  });
});
