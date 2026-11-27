import type { RunPolicyContract } from '@runs/application/contracts/run-order.contract';
import type { RunLeasesPort } from '@runs/application/ports/run-leases.port';
import { firstOf } from '@shared-kernel/domain/item-at';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { GrantRunAttachmentUploadCommand } from '@work/application/commands/grant-run-attachment-upload.command';
import { GrantRunAttachmentUploadHandler } from '@work/application/commands/handlers/grant-run-attachment-upload.handler';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import { describe, expect, it, vi } from 'vitest';

type Leased = Awaited<ReturnType<RunLeasesPort['leasedBy']>>;

const runOf = ({ leased = true, replay = false } = {}): Leased =>
  leased
    ? partial<Leased>({
        runId: RunId.of('run_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        policy: partial<RunPolicyContract>({ actsBeyondItself: !replay }),
      })
    : null;

const granting = (run: Leased) => {
  const grant = vi.fn(
    (_workspaceId: WorkspaceId, _uploader: RunId, _file: Attachment) =>
      Promise.resolve({
        url: 'https://files.example/put',
        headers: { 'content-type': 'image/png' },
      }),
  );
  const handler = new GrantRunAttachmentUploadHandler(
    partial<RunLeasesPort>({ leasedBy: () => Promise.resolve(run) }),
    partial<AttachmentStorePort>({ grant }),
    { generate: () => 'file_1' },
  );

  return { handler, grant };
};

const asking = (size = 3) =>
  new GrantRunAttachmentUploadCommand(
    'run_1',
    'runner_1',
    'light.png',
    'image/png',
    size,
  );

describe('GrantRunAttachmentUploadHandler', () => {
  it('grants an upload into the run’s workspace, by the run', async () => {
    const { handler, grant } = granting(runOf());

    expect(await handler.execute(asking())).toEqual({
      id: 'file_1',
      url: 'https://files.example/put',
      headers: { 'content-type': 'image/png' },
    });

    const [workspaceId, uploader, file] = firstOf(grant.mock.calls) ?? [];
    expect(workspaceId).toEqual(WorkspaceId.of('ws_1'));
    expect(uploader).toEqual(RunId.of('run_1'));
    expect([file?.name, file?.contentType, file?.size]).toEqual([
      'light.png',
      'image/png',
      3,
    ]);
  });

  it('grants nothing for a run this runner does not hold', async () => {
    const { handler, grant } = granting(runOf({ leased: false }));

    expect(await handler.execute(asking())).toBeNull();
    expect(grant).not.toHaveBeenCalled();
  });

  it('refuses a replay, which leaves nothing behind', async () => {
    const { handler, grant } = granting(runOf({ replay: true }));

    await expect(handler.execute(asking())).rejects.toThrow('attach a file');
    expect(grant).not.toHaveBeenCalled();
  });

  it('refuses a file larger than an attachment may be', async () => {
    const { handler, grant } = granting(runOf());

    await expect(handler.execute(asking(26 * 1024 * 1024))).rejects.toThrow(
      'must be no larger than 25 MB',
    );
    expect(grant).not.toHaveBeenCalled();
  });
});
