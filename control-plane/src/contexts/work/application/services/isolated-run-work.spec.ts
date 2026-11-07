import type { RunRepository } from '@runs/application/ports/run-fixtures.fake-spec';
import {
  claimer,
  Run,
  Runs,
  runReadModelOver,
} from '@runs/application/ports/run-fixtures.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { IsolatedRunWork } from '@work/application/services/isolated-run-work';
import { aRunFor } from '@work/application/services/run-works.fake-spec';
import { NotAllowedForIsolatedRunError } from '@work/domain/exceptions/not-allowed-for-isolated-run.error';
import { ToolNotEnabledError } from '@work/domain/exceptions/tool-not-enabled.error';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-02T09:00:00.000Z');
const RUNNER = RunnerId.of('runner_1');

const search = () =>
  aRunFor(RunId.of('run_9'), 'claude-code', 'search').claim(
    claimer(RUNNER),
    NOW,
  );

const working = async (leasedNow: (run: Run) => Run = (run) => run) => {
  const saved: Run[] = [];
  const searched = search();
  let current: Run = leasedNow(searched.renewLease(RUNNER, NOW));
  const runs = {
    findById: async () => current,
    save: async (run: Run) => {
      if (run.version !== current.version) {
        throw new Error('saved a run that changed');
      }
      saved.push(run);
      current = run;
    },
  } as unknown as RunRepository;
  const work = new IsolatedRunWork(
    await runReadModelOver({ findById: async () => searched }).leaseOf(
      searched.id,
      RUNNER,
    ),
    new Runs(
      runs,
      { sha256: (text) => text },
      { now: () => NOW, sleep: async () => {} },
    ),
  );

  return { work, saved };
};

describe('the work of a run that acts on nothing beyond itself', () => {
  it('uses no repository, to fetch or to push', async () => {
    const { work } = await working();

    await expect(work.repositoryNamed('api')).rejects.toThrow(
      NotAllowedForIsolatedRunError,
    );
  });

  it('reads no attachment', async () => {
    expect((await working()).work.attachment()).toBeNull();
  });

  it('uses no tool', async () => {
    const { work } = await working();

    await expect(work.toolContext(Tool.of('linear.comment'))).rejects.toThrow(
      ToolNotEnabledError,
    );
    expect((await work.clearFor()).kind).toBe('dismissed');
  });

  it('takes up nothing a person says', async () => {
    await expect((await working()).work.acknowledgeUpTo()).rejects.toThrow(
      NotAllowedForIsolatedRunError,
    );
  });

  it('records a permission it would have asked a person for on the run, and ends its turn there', async () => {
    const { work, saved } = await working();

    expect(await work.clearPermission()).toBe('pending');
    expect(saved[0]?.askedAPerson).toBe(true);
  });

  it('asks nothing on a run another runner leases by now', async () => {
    const { work, saved } = await working((run) =>
      run
        .expireLease(run.leaseExpiresAt as Date)
        .claim(claimer(RunnerId.of('runner_2')), NOW),
    );

    await expect(work.clearPermission()).rejects.toThrow();
    expect(saved).toEqual([]);
  });
});
