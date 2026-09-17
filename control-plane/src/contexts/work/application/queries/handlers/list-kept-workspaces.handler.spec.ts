import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type {
  KeptWorkspace,
  KeptWorkspaceReaderPort,
} from '@work/application/ports/kept-workspace-reader.port';
import { ListKeptWorkspacesHandler } from '@work/application/queries/handlers/list-kept-workspaces.handler';
import { ListKeptWorkspacesQuery } from '@work/application/queries/list-kept-workspaces.query';
import { describe, expect, it, vi } from 'vitest';

const reader = (held: KeptWorkspace[]) =>
  ({
    listFor: vi.fn(async (_: RunnerId) => held),
  }) satisfies KeptWorkspaceReaderPort;

const answer = (held: KeptWorkspace[]) =>
  new ListKeptWorkspacesHandler(reader(held)).execute(
    new ListKeptWorkspacesQuery('runner_1'),
  );

describe('ListKeptWorkspaces', () => {
  it('names a directory for each task it is holding', async () => {
    const keys = await answer([
      { taskId: 'task_1', stationId: 'station_2' },
      { taskId: 'task_2', stationId: 'station_3' },
    ]);

    expect(keys).toEqual(['task_1-station_2', 'task_2-station_3']);
  });

  it('answers with nothing when there is nothing to return for', async () => {
    expect(await answer([])).toEqual([]);
  });

  it('asks only about the runner that is asking', async () => {
    const held = reader([]);

    await new ListKeptWorkspacesHandler(held).execute(
      new ListKeptWorkspacesQuery('runner_1'),
    );

    expect(held.listFor).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'runner_1' }),
    );
  });
});
