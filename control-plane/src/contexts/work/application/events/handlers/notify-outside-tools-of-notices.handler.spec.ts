import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { NotifyOutsideToolsOfNotices } from '@work/application/events/handlers/notify-outside-tools-of-notices.handler';
import type { TeamNoticesPort } from '@work/application/ports/team-notices.port';
import { Notice } from '@work/domain/aggregates/notice.aggregate';
import { NoticeRaised } from '@work/domain/events/notice-raised.event';
import type { NoticeRepository } from '@work/domain/repositories/notice.repository';
import { NoticeExternalLink } from '@work/domain/value-objects/notice-external-link.vo';
import { NoticeId } from '@work/domain/value-objects/notice-id.vo';
import { NoticeLink } from '@work/domain/value-objects/notice-link.vo';
import { NoticeSubject } from '@work/domain/value-objects/notice-subject.vo';
import { NoticeWording } from '@work/domain/value-objects/notice-wording.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-10-01T09:00:00.000Z');

const raised = (
  externalLink: NoticeExternalLink | null,
  addressee: UserId | null = null,
) =>
  Notice.create({
    id: NoticeId.of('notice_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    addressee,
    form: 'ended',
    subject: NoticeSubject.of('replay-search search_1 result'),
    link: NoticeLink.of({
      path: 'lines/line_1/stations/station_1',
      label: 'Open the station',
    }),
    externalLink,
    wording: NoticeWording.of({
      headline: 'Spotlight opened a config pull request',
      points: ['Held-out gain: +39 points'],
    }),
    at: NOW,
  });

const PULL_REQUEST = NoticeExternalLink.of({
  url: 'https://github.com/acme/config/pull/12',
  label: 'Review the pull request',
});

const notifying = (notice: Notice | null) => {
  const notify = vi.fn<TeamNoticesPort['notify']>(async () => {});
  const handler = new NotifyOutsideToolsOfNotices(
    { find: async () => notice } as unknown as NoticeRepository,
    { notify },
  );

  return { handler, notify };
};

const event = new NoticeRaised(
  NoticeId.of('notice_1'),
  WorkspaceId.of('ws_1'),
  TeamId.of('team_1'),
  null,
  NOW,
);

describe('NotifyOutsideToolsOfNotices', () => {
  it('tells outside tools what a raised notice says', async () => {
    const { handler, notify } = notifying(raised(PULL_REQUEST));

    await handler.on(event);

    expect(notify).toHaveBeenCalledWith({
      id: 'notice_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      form: 'ended',
      headline: 'Spotlight opened a config pull request',
      points: ['Held-out gain: +39 points'],
      externalLink: {
        url: 'https://github.com/acme/config/pull/12',
        label: 'Review the pull request',
      },
    });
  });

  it('sends no outside link for a notice without one', async () => {
    const { handler, notify } = notifying(raised(null));

    await handler.on(event);

    expect(notify.mock.calls[0]?.[0].externalLink).toBeNull();
  });

  it('keeps quiet about a notice resolved before the tools heard of it', async () => {
    const { handler, notify } = notifying(
      raised(null).resolve(new Date('2026-10-01T09:05:00.000Z')),
    );

    await handler.on(event);

    expect(notify).not.toHaveBeenCalled();
  });

  it('keeps quiet about a notice that no longer exists', async () => {
    const { handler, notify } = notifying(null);

    await handler.on(event);

    expect(notify).not.toHaveBeenCalled();
  });

  it('keeps quiet about a notice addressed to one person', async () => {
    const { handler, notify } = notifying(
      raised(PULL_REQUEST, UserId.of('user_1')),
    );

    await handler.on(event);

    expect(notify).not.toHaveBeenCalled();
  });
});
