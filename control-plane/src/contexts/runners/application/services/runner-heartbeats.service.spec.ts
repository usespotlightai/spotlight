import { RunnerHeartbeats } from '@runners/application/services/runner-heartbeats.service';
import type { Runner } from '@runners/domain/aggregates/runner.aggregate';
import {
  aRunner,
  aTrust,
  STARTED_AT,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import { RunnerVersionConflictError } from '@runners/domain/exceptions/runner-version-conflict.error';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import { InstalledHarness } from '@runners/domain/value-objects/installed-harness.vo';
import { RunnerWork } from '@runners/domain/value-objects/runner-work.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunningImage } from '@shared-kernel/domain/value-objects/running-image.vo';
import { describe, expect, it, vi } from 'vitest';

const ID = RunnerId.of('pooled_1');

const later = (ms: number): Date => new Date(STARTED_AT.getTime() + ms);

const setUp = (runner: Runner | null) => {
  const save = vi.fn(async () => {});

  return {
    save,
    heartbeats: new RunnerHeartbeats({
      find: vi.fn(async () => runner),
      save,
    } as unknown as RunnerRepository),
  };
};

describe('RunnerHeartbeats', () => {
  it('answers where the runner works, what it can run and what it may claim, and records the heartbeat', async () => {
    const { heartbeats, save } = setUp(
      aRunner({
        installed: [InstalledHarness.reported('claude-code', [], '2.1.0')],
      }),
    );

    const heartbeat = await heartbeats.heartbeat(ID, later(1));

    expect(heartbeat?.workspaceId.value).toBe('ws_1');
    expect(heartbeat?.harnesses.map((each) => each.value)).toEqual([
      'claude-code',
    ]);
    expect(heartbeat?.terms.values).toEqual(['linux']);
    expect(heartbeat?.claims).toBe('reserved');
    expect(save).toHaveBeenCalledOnce();
  });

  it('answers serving only the image the runner was started in', async () => {
    const widgets = RunnerImage.of('ghcr.io/acme/widgets:1');
    const { heartbeats } = setUp(
      aRunner({ running: RunningImage.of(widgets, false) }),
    );

    const terms = (await heartbeats.heartbeat(ID, later(1)))?.terms;

    expect(terms?.serves(widgets)).toBe(true);
    expect(terms?.serves(null)).toBe(false);
  });

  it('answers to the labels of the trust it started through', async () => {
    const { heartbeats } = setUp(aRunner({ through: aTrust() }));

    expect((await heartbeats.heartbeat(ID, later(1)))?.terms.values).toEqual([
      'vpc-internal',
    ]);
  });

  it('keeps harnesses reported while it was reading, rather than writing over them', async () => {
    const find = vi
      .fn()
      .mockResolvedValueOnce(aRunner())
      .mockResolvedValueOnce(
        aRunner({ installed: [InstalledHarness.reported('claude-code', [])] }),
      );
    const save = vi
      .fn()
      .mockRejectedValueOnce(new RunnerVersionConflictError(ID.value))
      .mockResolvedValueOnce(undefined);

    const heartbeat = await new RunnerHeartbeats({
      find,
      save,
    } as unknown as RunnerRepository).heartbeat(ID, later(1));

    expect(save.mock.calls[1]?.[0]).toMatchObject({
      lastHeartbeatAt: later(1),
    });
    expect(heartbeat?.harnesses.map((each) => each.value)).toEqual([
      'claude-code',
    ]);
  });

  it('says a runner that claimed its work may claim nothing more', async () => {
    const { heartbeats } = setUp(
      aRunner().claim(RunnerWork.run('run_1'), later(1)),
    );

    expect((await heartbeats.heartbeat(ID, later(2)))?.claims).toBe('nothing');
  });

  it('knows nothing of a runner never started', async () => {
    await expect(
      setUp(null).heartbeats.heartbeat(ID, later(1)),
    ).resolves.toBeNull();
  });

  it('knows nothing of one that has ended', async () => {
    const { heartbeats } = setUp(
      aRunner().claim(RunnerWork.run('run_1'), STARTED_AT).ended(STARTED_AT),
    );

    await expect(heartbeats.heartbeat(ID, STARTED_AT)).resolves.toBeNull();
  });

  it('knows nothing of one whose claim expired, and does not record the heartbeat', async () => {
    const { heartbeats, save } = setUp(aRunner({ claimWithinMs: 1_000 }));

    await expect(heartbeats.heartbeat(ID, later(1_000))).resolves.toBeNull();
    expect(save).not.toHaveBeenCalled();
  });
});
