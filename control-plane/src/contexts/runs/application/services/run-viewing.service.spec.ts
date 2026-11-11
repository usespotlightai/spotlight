import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { RunFactsPort } from '@runs/application/ports/run-facts.port';
import {
  type ListedRun,
  RunViewing,
} from '@runs/application/services/run-viewing.service';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const VIEWER = UserId.of('user_1');

const run = (id: string, owner: string, listed = true): ListedRun => ({
  runId: RunId.of(id),
  workspaceId: WorkspaceId.of('ws_1'),
  requester: { owner, kind: 'spec', id, token: null, team: null },
  policy: { listed },
});

const viewing = (member: boolean) =>
  new RunViewing(
    {} as RunFactsPort,
    { mayView: async () => member } as unknown as WorkspaceAccessPort,
  );

describe('RunViewing', () => {
  it('shows no one a run its requester did not list', async () => {
    expect(
      await viewing(true).readableAmong(
        [run('run_1', 'workspace', false)],
        VIEWER,
      ),
    ).toEqual(new Set());
  });

  it('shows a run of an owner without a viewer source to the members of its workspace', async () => {
    const runs = [run('run_1', 'workspace')];

    expect(await viewing(true).readableAmong(runs, VIEWER)).toEqual(
      new Set(['run_1']),
    );
    expect(await viewing(false).readableAmong(runs, VIEWER)).toEqual(new Set());
  });

  it('lets an owner’s viewer source decide for its own runs only', async () => {
    const viewers = viewing(true);
    viewers.register({ owner: 'work', readableAmong: async () => new Set() });

    expect(
      await viewers.readableAmong(
        [run('run_1', 'work'), run('run_2', 'replays')],
        VIEWER,
      ),
    ).toEqual(new Set(['run_2']));
  });
});
