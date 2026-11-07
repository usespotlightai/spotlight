import type { RunsPort } from '@runs/application/ports/runs.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import {
  RunNotLeased,
  recordingRuns,
} from '@work/application/ports/runs.fake-spec';
import { IsolatedRunWork } from '@work/application/services/isolated-run-work';
import { leasedRunFor } from '@work/application/services/run-works.fake-spec';
import { NotAllowedForIsolatedRunError } from '@work/domain/exceptions/not-allowed-for-isolated-run.error';
import { ToolNotEnabledError } from '@work/domain/exceptions/tool-not-enabled.error';
import { describe, expect, it } from 'vitest';

const RUN = RunId.of('run_9');
const RUNNER = RunnerId.of('runner_1');

const working = (answers: Partial<RunsPort> = {}) => {
  const runs = recordingRuns(answers);
  const work = new IsolatedRunWork(
    leasedRunFor(RUN, 'claude-code', 'search', { claimedBy: RUNNER }),
    runs,
  );

  return { work, runs };
};

describe('the work of a run that acts on nothing beyond itself', () => {
  it('uses no repository, to fetch or to push', async () => {
    const { work } = working();

    await expect(work.repositoryNamed('api')).rejects.toThrow(
      NotAllowedForIsolatedRunError,
    );
  });

  it('reads no attachment', async () => {
    expect(working().work.attachment()).toBeNull();
  });

  it('uses no tool', async () => {
    const { work } = working();

    await expect(work.toolContext(Tool.of('linear.comment'))).rejects.toThrow(
      ToolNotEnabledError,
    );
    expect((await work.clearFor()).kind).toBe('dismissed');
  });

  it('takes up nothing a person says', async () => {
    await expect(working().work.acknowledgeUpTo()).rejects.toThrow(
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

  it('ends no turn where the run refuses the lease it held', async () => {
    const { work } = working({
      askedAPerson: async () => {
        throw new RunNotLeased('Run run_9 is leased by runner_2.');
      },
    });

    await expect(work.clearPermission()).rejects.toThrow(RunNotLeased);
  });
});
