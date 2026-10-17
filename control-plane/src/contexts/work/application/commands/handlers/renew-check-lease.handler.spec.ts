import type { RunnerPresencePort } from '@runners/application/ports/runner-presence.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { RenewCheckLeaseHandler } from '@work/application/commands/handlers/renew-check-lease.handler';
import { RenewCheckLeaseCommand } from '@work/application/commands/runner.commands';
import type {
  CheckLeaseRenewal,
  CheckWorkPort,
} from '@work/application/ports/check-work.port';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-28T09:00:00.000Z');

const renewing = (
  given: { known?: boolean; answer?: CheckLeaseRenewal | Error } = {},
) => {
  const seen = vi.fn(async () =>
    given.known === false
      ? null
      : {
          workspaceId: WorkspaceId.of('ws_1'),
          harnesses: [HarnessId.of('claude-code')],
          terms: RunnerTerms.none(),
          claims: 'nothing' as const,
        },
  );
  const renewLease = vi.fn(async (): Promise<CheckLeaseRenewal> => {
    if (given.answer instanceof Error) {
      throw given.answer;
    }
    return given.answer ?? 'renewed';
  });

  const handler = new RenewCheckLeaseHandler(
    { renewLease } as unknown as CheckWorkPort,
    { seen } satisfies RunnerPresencePort,
    { now: () => NOW } as ClockPort,
  );

  return { handler, seen, renewLease };
};

const renewal = () =>
  new RenewCheckLeaseCommand('run_1', 'stack_1', false, 'runner_1');

describe('RenewCheckLeaseHandler', () => {
  it('keeps the runner standing while it renews the check it leases', async () => {
    const { handler, seen, renewLease } = renewing();

    await expect(handler.execute(renewal())).resolves.toBe('renewed');
    expect(seen).toHaveBeenCalledWith(RunnerId.of('runner_1'), NOW);
    expect(renewLease).toHaveBeenCalledWith(
      RunId.of('run_1'),
      'stack_1',
      false,
      RunnerId.of('runner_1'),
      NOW,
    );
  });

  it('passes on that the runner should stop checking', async () => {
    const { handler } = renewing({ answer: 'stop' });

    await expect(handler.execute(renewal())).resolves.toBe('stop');
  });

  it('turns away a runner that is no longer known', async () => {
    const { handler, renewLease } = renewing({ known: false });

    await expect(handler.execute(renewal())).rejects.toMatchObject({
      kind: 'not-found',
      message: 'Runner runner_1 not found.',
    });
    expect(renewLease).not.toHaveBeenCalled();
  });

  it('answers a refusal to renew as a fault', async () => {
    const notLeased = Object.assign(new Error('not leased'), {
      violation: 'conflict' as const,
    });
    const { handler } = renewing({ answer: notLeased });

    await expect(handler.execute(renewal())).rejects.toMatchObject({
      kind: 'conflict',
    });
  });
});
