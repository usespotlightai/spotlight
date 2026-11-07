import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { recordingRuns } from '@work/application/ports/runs.fake-spec';
import { leasedRunFor } from '@work/application/services/run-works.fake-spec';
import { TrialRunWork } from '@work/application/services/trial-run-work';
import { NotAllowedForIsolatedRunError } from '@work/domain/exceptions/not-allowed-for-isolated-run.error';
import { ToolNotEnabledError } from '@work/domain/exceptions/tool-not-enabled.error';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import { describe, expect, it } from 'vitest';

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

const RUN = RunId.of('run_2');

const working = () => {
  const runs = recordingRuns();
  const work = new TrialRunWork(
    leasedRunFor(RUN, 'dev', 'trial', { claimedBy: RUNNER }),
    briefed,
    [{ path: 'api', repository: Repository.of('acme/api') }],
    runs,
  );

  return { work, runs };
};

describe('the work of a trial', () => {
  it('fetches the repositories it checks out, and no others', async () => {
    const { work } = working();

    expect((await work.repositoryNamed('api', 'git-upload-pack'))?.value).toBe(
      'acme/api',
    );
    expect(await work.repositoryNamed('web', 'git-upload-pack')).toBeNull();
  });

  it('never pushes', async () => {
    const { work } = working();

    await expect(
      work.repositoryNamed('api', 'git-receive-pack'),
    ).rejects.toThrow(NotAllowedForIsolatedRunError);
  });

  it('reads the files its original was briefed with, and no others', async () => {
    const { work } = working();

    expect(work.attachment(SCREENSHOT.id.value)?.equals(SCREENSHOT)).toBe(true);
    expect(work.attachment('another')).toBeNull();
  });

  it('uses no tool', async () => {
    const { work } = working();

    await expect(work.toolContext(Tool.of('linear.comment'))).rejects.toThrow(
      ToolNotEnabledError,
    );
    expect((await work.clearFor()).kind).toBe('dismissed');
  });

  it('takes up nothing a person says', async () => {
    const { work } = working();

    await expect(work.acknowledgeUpTo()).rejects.toThrow(
      NotAllowedForIsolatedRunError,
    );
  });

  it('records a permission it would have asked a person for on the run, and ends its turn there', async () => {
    const { work, runs } = working();

    expect(await work.clearPermission()).toBe('pending');
    expect(runs.askedAPerson).toHaveBeenCalledWith({
      runId: RUN,
      runner: RUNNER,
    });
  });
});
