import type { MemberLookupPort } from '@identity/application/ports/member-lookup.port';
import type {
  MemberMailPort,
  MemberMailToSend,
} from '@identity/application/ports/member-mail.port';
import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import { MemberNotices } from '@identity/application/services/member-notices.service';
import { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import { WorkspaceMemberLeft } from '@identity/domain/events/workspace-member-left.event';
import { WorkspaceMemberSuspended } from '@identity/domain/events/workspace-member-suspended.event';
import { WorkspaceMemberUnsuspended } from '@identity/domain/events/workspace-member-unsuspended.event';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const ADA = UserId.of('user_ada');
const LEON = UserId.of('user_leon');
const AT = new Date('2026-11-20T10:00:00.000Z');

const acme = () =>
  Workspace.rehydrate({
    id: WORKSPACE,
    name: WorkspaceName.of('Acme'),
    slug: WorkspaceSlug.of('acme'),
    members: [{ userId: LEON, role: WorkspaceRole.owner, suspendedAt: null }],
    version: 0,
  });

const noticing = (
  over: {
    workspace?: Workspace | null;
    emails?: readonly string[];
    send?: MemberMailPort['send'];
  } = {},
) => {
  const send = vi.fn<MemberMailPort['send']>(over.send ?? (async () => {}));
  const warn = vi.fn();
  const notices = new MemberNotices(
    partial<WorkspaceRepository>({
      find: () =>
        Promise.resolve(over.workspace === undefined ? acme() : over.workspace),
    }),
    partial<MemberLookupPort>({
      emailsOf: () => Promise.resolve(over.emails ?? ['ada@example.com']),
    }),
    partial<PersonReaderPort>({
      find: (id: UserId) =>
        Promise.resolve({
          id,
          name: 'Leon Liang',
          image: null,
        }),
    }),
    { send },
    partial<LoggerPort>({ warn }),
  );

  return { notices, send, warn };
};

const sent = (mail: Partial<MemberMailToSend>): MemberMailToSend => ({
  kind: 'suspended',
  to: 'ada@example.com',
  workspaceName: 'Acme',
  by: 'Leon Liang',
  ...mail,
});

describe('MemberNotices', () => {
  it('mails a suspended person, naming who did it', async () => {
    const { notices, send } = noticing();

    await notices.suspended(
      new WorkspaceMemberSuspended(WORKSPACE, ADA, LEON, AT),
    );

    expect(send).toHaveBeenCalledWith(sent({}));
  });

  it('mails a person who is unsuspended', async () => {
    const { notices, send } = noticing();

    await notices.unsuspended(
      new WorkspaceMemberUnsuspended(WORKSPACE, ADA, LEON, AT),
    );

    expect(send).toHaveBeenCalledWith(sent({ kind: 'unsuspended' }));
  });

  it('mails a person who left, naming nobody', async () => {
    const { notices, send } = noticing();

    await notices.left(new WorkspaceMemberLeft(WORKSPACE, ADA, AT));

    expect(send).toHaveBeenCalledWith(sent({ kind: 'left', by: null }));
  });

  it('mails nobody who has no email, and nobody of a workspace that is gone', async () => {
    const event = new WorkspaceMemberLeft(WORKSPACE, ADA, AT);
    const noEmail = noticing({ emails: [] });
    const noWorkspace = noticing({ workspace: null });

    await noEmail.notices.left(event);
    await noWorkspace.notices.left(event);

    expect(noEmail.send).not.toHaveBeenCalled();
    expect(noWorkspace.send).not.toHaveBeenCalled();
  });

  it('warns and goes on where the mail fails, so the change stands', async () => {
    const { notices, warn } = noticing({
      send: () => {
        return Promise.reject(new Error('smtp down'));
      },
    });

    await expect(
      notices.left(new WorkspaceMemberLeft(WORKSPACE, ADA, AT)),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
