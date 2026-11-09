import { ChangeNotices } from '@platform/live/change-notices';
import { RunClaimed } from '@runs/domain/events/run-claimed.event';
import { RunStopRequested } from '@runs/domain/events/run-stop-requested.event';
import { RUNS_CHANGE_NOTICES } from '@runs/presentation/live/runs.change-notices';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

describe('Runs change notices', () => {
  it('tells the workspace which run changed, once for several of its events', () => {
    const notices = new ChangeNotices();
    notices.register(RUNS_CHANGE_NOTICES);
    const run = RunId.of('run_1');
    const workspace = WorkspaceId.of('ws_1');

    expect(
      notices.of(
        [
          new RunClaimed(run, workspace, RunnerId.of('runner_1')),
          new RunStopRequested(run, workspace),
        ],
        (name, error) => {
          throw new Error(`${name} failed: ${String(error)}`);
        },
      ),
    ).toEqual([
      { channel: 'workspace:ws_1', topic: 'run', ids: { runId: 'run_1' } },
    ]);
  });
});
