import { RunnerPresence } from '@runners/application/services/runner-presence.service';
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

const holding = (runner: Runner | null) => {
  const save = vi.fn(async () => {});

  return {
    save,
    presence: new RunnerPresence({
      find: vi.fn(async () => runner),
      save,
    } as unknown as RunnerRepository),
  };
};

describe('RunnerPresence', () => {
  it('answers where the runner works, what it can run and what it may claim, marking it seen', async () => {
    const { presence, save } = holding(
      aRunner({
        installed: [InstalledHarness.reported('claude-code', [], '2.1.0')],
      }),
    );

    const seen = await presence.seen(ID, later(1));

    expect(seen?.workspaceId.value).toBe('ws_1');
    expect(seen?.harnesses.map((each) => each.value)).toEqual(['claude-code']);
    expect(seen?.terms.values).toEqual(['linux']);
    expect(seen?.claims).toBe('reserved');
    expect(save).toHaveBeenCalledOnce();
  });

  it('answers serving only the image the runner was started in', async () => {
    const widgets = RunnerImage.of('ghcr.io/acme/widgets:1');
    const { presence } = holding(
      aRunner({ running: RunningImage.of(widgets, false) }),
    );

    const terms = (await presence.seen(ID, later(1)))?.terms;

    expect(terms?.serves(widgets)).toBe(true);
    expect(terms?.serves(null)).toBe(false);
  });

  it('answers to the labels of the trust that admitted it', async () => {
    const { presence } = holding(aRunner({ through: aTrust() }));

    expect((await presence.seen(ID, later(1)))?.terms.values).toEqual([
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

    const seen = await new RunnerPresence({
      find,
      save,
    } as unknown as RunnerRepository).seen(ID, later(1));

    expect(save.mock.calls[1]?.[0]).toMatchObject({ lastSeenAt: later(1) });
    expect(seen?.harnesses.map((each) => each.value)).toEqual(['claude-code']);
  });

  it('says a runner that took its work may claim nothing more', async () => {
    const { presence } = holding(
      aRunner().took(RunnerWork.run('run_1'), later(1)),
    );

    expect((await presence.seen(ID, later(2)))?.claims).toBe('nothing');
  });

  it('knows nothing of a runner never started', async () => {
    await expect(holding(null).presence.seen(ID, later(1))).resolves.toBeNull();
  });

  it('knows nothing of one that has ended', async () => {
    const { presence } = holding(
      aRunner().took(RunnerWork.run('run_1'), STARTED_AT).ended(STARTED_AT),
    );

    await expect(presence.seen(ID, STARTED_AT)).resolves.toBeNull();
  });

  it('knows nothing of one that let its claim lapse, and does not mark it seen', async () => {
    const { presence, save } = holding(aRunner({ claimWithinMs: 1_000 }));

    await expect(presence.seen(ID, later(1_000))).resolves.toBeNull();
    expect(save).not.toHaveBeenCalled();
  });
});
