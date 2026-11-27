import type { RunnerClaimantsPort } from '@runners/application/ports/runner-claimants.port';
import { RenewReviewWorkLeaseHandler } from '@runs/application/commands/handlers/renew-review-work-lease.handler';
import { RenewReviewWorkLeaseCommand } from '@runs/application/commands/runner.commands';
import type {
  ReviewWorkLeaseRenewal,
  ReviewWorkPort,
} from '@runs/application/ports/review-work.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { ReviewWorkId } from '@shared-kernel/domain/value-objects/review-work-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-28T09:00:00.000Z');

const renewing = (
  options: { known?: boolean; answer?: ReviewWorkLeaseRenewal | Error } = {},
) => {
  const seen = vi.fn(() =>
    Promise.resolve(
      options.known === false
        ? null
        : {
            workspaceId: WorkspaceId.of('ws_1'),
            harnesses: [HarnessId.of('claude-code')],
            offer: RunnerOffer.none(),
            claims: 'nothing' as const,
            source: null,
          },
    ),
  );
  const renewLease = vi.fn((): Promise<ReviewWorkLeaseRenewal> => {
    if (options.answer instanceof Error) {
      return Promise.reject(options.answer);
    }
    return Promise.resolve(options.answer ?? 'renewed');
  });

  const handler = new RenewReviewWorkLeaseHandler(
    partial<ReviewWorkPort>({ renewLease }),
    {
      claimantOf: seen,
      registeredClaimantOf: () => Promise.resolve(null),
    } satisfies RunnerClaimantsPort,
    partial<ClockPort>({ now: () => NOW }),
  );

  return { handler, seen, renewLease };
};

const renewal = () =>
  new RenewReviewWorkLeaseCommand(
    { kind: 'check', stackId: 'stack_1', recheck: true },
    'runner_1',
  );

describe('RenewReviewWorkLeaseHandler', () => {
  it('keeps the runner alive while it renews the check it leases', async () => {
    const { handler, seen, renewLease } = renewing();

    await expect(handler.execute(renewal())).resolves.toBe('renewed');
    expect(seen).toHaveBeenCalledWith(RunnerId.of('runner_1'), NOW);
    expect(renewLease).toHaveBeenCalledWith(
      { kind: 'check', id: ReviewWorkId.of('stack_1'), recheck: true },
      RunnerId.of('runner_1'),
      NOW,
    );
  });

  it('renews a push diff as a diff, with no recheck', async () => {
    const { handler, renewLease } = renewing();

    await expect(
      handler.execute(
        new RenewReviewWorkLeaseCommand(
          { kind: 'diff', diffId: 'diff_1' },
          'runner_1',
        ),
      ),
    ).resolves.toBe('renewed');
    expect(renewLease).toHaveBeenCalledWith(
      { kind: 'diff', id: ReviewWorkId.of('diff_1') },
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

  it('answers a renewal that fails as a fault', async () => {
    const notLeased = Object.assign(new Error('not leased'), {
      kind: 'conflict' as const,
    });
    const { handler } = renewing({ answer: notLeased });

    await expect(handler.execute(renewal())).rejects.toMatchObject({
      kind: 'conflict',
    });
  });
});
