import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { claimedRun } from '@work/application/services/claimed-work';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { orderedFor } from '@work/domain/aggregates/run.fake-spec';
import { RunExtensions } from '@work/domain/value-objects/run-extensions.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-07T10:00:00.000Z');
const COMMIT = 'c'.repeat(40);

describe('the run a runner claims', () => {
  it('carries the requester’s extensions beside the spec and the workspace as its resume key, as runners read them', () => {
    const replay = {
      archive: 'archive_1',
      checkouts: [{ path: 'api', commit: COMMIT, repository: 'acme/api' }],
      movesOnAfter: ['spec'],
    };
    const run = Run.enqueue({
      id: RunId.of('run_1'),
      workspaceId: WorkspaceId.of('ws_1'),
      harness: HarnessId.of('dev'),
      ...orderedFor.isolated('replay', 'run_1'),
      restore: WorkspaceArchiveId.of('archive_1'),
      extensions: RunExtensions.of({ replay }),
      spec: RunSpec.of({
        checkouts: [
          { remote: 'spotlight:repository', path: 'api', ref: COMMIT },
        ],
        command: { executable: 'sh', args: [] },
        briefing: 'Fix the queue.',
        handover: { options: ['done'], noteLimit: 0 },
        resume: {},
      }),
    }).claim(RunnerId.of('runner_1'), NOW);

    expect(claimedRun(run)).toEqual({
      kind: 'run',
      run: {
        id: 'run_1',
        harness: 'dev',
        attempt: 1,
        spec: {
          checkouts: [
            { remote: 'spotlight:repository', path: 'api', ref: COMMIT },
          ],
          command: { executable: 'sh', args: [] },
          briefing: 'Fix the queue.',
          handover: { options: ['done'], noteLimit: 0 },
          resume: { key: 'replays/replay-run_1' },
          replay,
        },
      },
    });
  });

  it('names an empty key for a run without a workspace', () => {
    const run = Run.enqueue({
      id: RunId.of('run_1'),
      workspaceId: WorkspaceId.of('ws_1'),
      harness: HarnessId.of('dev'),
      ...orderedFor.spec(),
      spec: RunSpec.of({
        command: { executable: 'sh', args: [] },
        briefing: 'Fix the queue.',
        handover: { options: [], noteLimit: 0 },
        resume: { sessionId: 'session_1' },
      }),
    }).claim(RunnerId.of('runner_1'), NOW);

    const claimed = claimedRun(run);

    expect(claimed.kind === 'run' && claimed.run.spec).toMatchObject({
      resume: { key: '', sessionId: 'session_1' },
    });
  });
});
