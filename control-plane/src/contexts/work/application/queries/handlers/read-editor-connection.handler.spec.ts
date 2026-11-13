import type { EditorLeasesPort } from '@runners/application/ports/editor-leases.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { EditorTarget } from '@work/application/dto/editor-connection.dto';
import { ReadEditorConnectionQuery } from '@work/application/queries/editor-connection.query';
import { ReadEditorConnectionHandler } from '@work/application/queries/handlers/read-editor-connection.handler';
import type { EditorTargets } from '@work/application/services/editor-targets.service';
import { TeamMembershipRequiredError } from '@work/domain/exceptions/team-membership-required.error';
import { describe, expect, it, vi } from 'vitest';

const TASK: EditorTarget = { kind: 'task', id: 'task_1' };

const setUp = () => {
  const workingCopyOf = vi.fn(
    async (_viewer: unknown, target: EditorTarget, _slug: string | null) =>
      target.id === 'task_1'
        ? { workspaceId: WorkspaceId.of('ws_1'), key: 'work/task-task_1' }
        : null,
  );
  const leases = { isHeld: vi.fn(async () => true) };
  const handler = new ReadEditorConnectionHandler(
    { workingCopyOf } as unknown as EditorTargets,
    leases as unknown as EditorLeasesPort,
  );

  return {
    workingCopyOf,
    leases,
    read: (target: EditorTarget, slug: string | null = 'acme') =>
      handler.execute(new ReadEditorConnectionQuery('user_bea', target, slug)),
  };
};

describe('ReadEditorConnectionHandler', () => {
  it('says whether an editor holds the sandbox of the working copy', async () => {
    const { read, leases, workingCopyOf } = setUp();

    expect(await read(TASK)).toEqual({ connected: true });
    expect(leases.isHeld).toHaveBeenCalledWith('ws_1', 'work/task-task_1');
    expect(workingCopyOf.mock.calls[0]?.[2]).toBe('acme');

    leases.isHeld.mockResolvedValueOnce(false);
    expect(await read(TASK, null)).toEqual({ connected: false });
  });

  it('reads nothing for a task or chat the person may not open', async () => {
    const { read, leases } = setUp();

    expect(await read({ kind: 'chat', id: 'chat_9' })).toBeNull();
    expect(leases.isHeld).not.toHaveBeenCalled();
  });

  it('passes on a refusal of the working copy', async () => {
    const { read, workingCopyOf } = setUp();
    workingCopyOf.mockRejectedValueOnce(new TeamMembershipRequiredError());

    await expect(read(TASK)).rejects.toMatchObject({
      refusal: expect.any(TeamMembershipRequiredError) as unknown,
    });
  });
});
