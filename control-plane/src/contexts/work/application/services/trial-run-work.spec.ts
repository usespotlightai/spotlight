import type { RunRepository } from '@runs/application/ports/run-fixtures.fake-spec';
import {
  claimer,
  Run,
  Runs,
  runReadModelOver,
} from '@runs/application/ports/run-fixtures.fake-spec';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { aRunFor } from '@work/application/services/run-works.fake-spec';
import { TrialRunWork } from '@work/application/services/trial-run-work';
import { NotAllowedForIsolatedRunError } from '@work/domain/exceptions/not-allowed-for-isolated-run.error';
import { ToolNotEnabledError } from '@work/domain/exceptions/tool-not-enabled.error';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-01T09:00:00.000Z');
const RUNNER = RunnerId.of('runner_1');
const BUILD = StationId.of('station_build');

const SCREENSHOT = Attachment.of({
  id: '5f0c1d84-9c2e-4c8b-9a3d-2b7e6d5a1f47',
  name: 'queue-stuck.png',
  contentType: 'image/png',
  size: 2_048,
});

const briefed = BriefedTask.of({
  stationId: BUILD,
  title: 'Fix the queue',
  description: null,
  reviewing: null,
  attachments: [SCREENSHOT],
  notes: [],
  openReviewComments: [],
});

const replay = () =>
  aRunFor(RunId.of('run_2'), 'dev', 'trial').claim(claimer(RUNNER), NOW);

const working = async () => {
  const saved: Run[] = [];
  const replayed = replay();
  let current: Run = replayed.renewLease(RUNNER, NOW);
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
  const work = new TrialRunWork(
    await runReadModelOver({ findById: async () => replayed }).leaseOf(
      replayed.id,
      RUNNER,
    ),
    briefed,
    [{ path: 'api', repository: Repository.of('acme/api') }],
    new Runs(
      runs,
      { sha256: (text) => text },
      { now: () => NOW, sleep: async () => {} },
    ),
  );

  return { work, saved };
};

describe('the work of a trial', () => {
  it('fetches the repositories it checks out, and no others', async () => {
    const { work } = await working();

    expect((await work.repositoryNamed('api', 'git-upload-pack'))?.value).toBe(
      'acme/api',
    );
    expect(await work.repositoryNamed('web', 'git-upload-pack')).toBeNull();
  });

  it('never pushes', async () => {
    const { work } = await working();

    await expect(
      work.repositoryNamed('api', 'git-receive-pack'),
    ).rejects.toThrow(NotAllowedForIsolatedRunError);
  });

  it('reads the files its original was briefed with, and no others', async () => {
    const { work } = await working();

    expect(work.attachment(SCREENSHOT.id.value)?.equals(SCREENSHOT)).toBe(true);
    expect(work.attachment('another')).toBeNull();
  });

  it('uses no tool', async () => {
    const { work } = await working();

    await expect(work.toolContext(Tool.of('linear.comment'))).rejects.toThrow(
      ToolNotEnabledError,
    );
    expect((await work.clearFor()).kind).toBe('dismissed');
  });

  it('takes up nothing a person says', async () => {
    const { work } = await working();

    await expect(work.acknowledgeUpTo()).rejects.toThrow(
      NotAllowedForIsolatedRunError,
    );
  });

  it('records a permission it would have asked a person for on the run as it is now, and ends its turn there', async () => {
    const { work, saved } = await working();

    expect(await work.clearPermission()).toBe('pending');
    expect(saved[0]?.askedAPerson).toBe(true);
  });
});
