import type {
  KeptWorkspace,
  KeptWorkspaceReaderPort,
} from '@application/ports/kept-workspace-reader.port';
import { ListKeptWorkspacesHandler } from '@application/queries/handlers/list-kept-workspaces.handler';
import { ListKeptWorkspacesQuery } from '@application/queries/list-kept-workspaces.query';
import type { RunnerId } from '@domain/value-objects/runner-id.vo';
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

  // A runner holding nothing worth returning for should be told so plainly,
  // not left to guess: everything it has can go.
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
