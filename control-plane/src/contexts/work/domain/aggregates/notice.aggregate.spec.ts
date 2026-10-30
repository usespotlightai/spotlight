import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Notice } from '@work/domain/aggregates/notice.aggregate';
import { InvalidNoticeError } from '@work/domain/exceptions/invalid-notice.error';
import { InvalidNoticeExternalLinkError } from '@work/domain/exceptions/invalid-notice-external-link.error';
import { NoticeExternalLink } from '@work/domain/value-objects/notice-external-link.vo';
import { noticeForm } from '@work/domain/value-objects/notice-form';
import { NoticeId } from '@work/domain/value-objects/notice-id.vo';
import { NoticeLink } from '@work/domain/value-objects/notice-link.vo';
import { NoticeWording } from '@work/domain/value-objects/notice-wording.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-01T09:00:00.000Z');

const later = (ms: number) => new Date(NOW.getTime() + ms);

const PERSON = UserId.of('user_1');

const created = (subject = 'replay-search search_1 iteration 3') =>
  Notice.create({
    id: NoticeId.of('notice_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    addressee: PERSON,
    form: 'ended',
    subject,
    link: NoticeLink.of({
      path: 'lines/line_1/stations/station_1',
      label: 'Open the station',
    }),
    externalLink: NoticeExternalLink.of({
      url: 'https://github.com/acme/config/pull/12',
      label: 'Review the pull request',
    }),
    wording: NoticeWording.of({
      headline: 'The search stalled',
      points: ['Fix the rubric.'],
    }),
    at: NOW,
  });

describe('Notice', () => {
  it('is created open, for one person only', () => {
    const notice = created();

    expect(notice.resolvedAt).toBeNull();
    expect(notice.version).toBe(0);
    expect(notice.isFor(PERSON)).toBe(true);
    expect(notice.isFor(UserId.of('user_2'))).toBe(false);
  });

  it('reopens once resolved, and leaves an open notice as it is', () => {
    const open = created();

    expect(open.resolve(later(3)).reopen().resolvedAt).toBeNull();
    expect(open.reopen()).toBe(open);
  });

  it('resolves once', () => {
    const resolved = created().resolve(later(3));

    expect(resolved.resolvedAt).toEqual(later(3));
    expect(resolved.resolve(later(4))).toBe(resolved);
  });

  it('rejects a subject it cannot name, a form it does not know, a link out of its team or unnamed, and wording out of bounds', () => {
    expect(() => created(' ')).toThrow(InvalidNoticeError);
    expect(() => noticeForm('gossip')).toThrow(InvalidNoticeError);
    for (const path of ['', '/lines/1', 'lines/../x', 'https://x.test/y']) {
      expect(() => NoticeLink.of({ path, label: 'Open it' })).toThrow(
        InvalidNoticeError,
      );
    }
    for (const label of [' ', 'x'.repeat(61)]) {
      expect(() => NoticeLink.of({ path: 'lines/line_1', label })).toThrow(
        InvalidNoticeError,
      );
    }
    expect(() =>
      NoticeWording.of({ headline: ' ', points: ['A point.'] }),
    ).toThrow(InvalidNoticeError);
    expect(() => NoticeWording.of({ headline: 'Fine', points: [] })).toThrow(
      InvalidNoticeError,
    );
    expect(() =>
      NoticeWording.of({
        headline: 'Fine',
        points: Array.from({ length: 21 }, () => 'A point.'),
      }),
    ).toThrow(InvalidNoticeError);
  });

  it('links outside Spotlight only to a GitHub address, with a label', () => {
    expect(created().externalLink?.url).toBe(
      'https://github.com/acme/config/pull/12',
    );
    for (const url of [
      '',
      'http://github.com/acme/config/pull/12',
      'https://github.com.evil.test/acme',
      'https://user:secret@github.com/acme',
      'https://github.com/',
      'javascript:alert(1)',
      'lines/line_1',
      `https://github.com/${'x'.repeat(500)}`,
    ]) {
      expect(() =>
        NoticeExternalLink.of({ url, label: 'Review the pull request' }),
      ).toThrow(InvalidNoticeExternalLinkError);
    }
    for (const label of [' ', 'x'.repeat(61)]) {
      expect(() =>
        NoticeExternalLink.of({
          url: 'https://github.com/acme/config/pull/12',
          label,
        }),
      ).toThrow(InvalidNoticeExternalLinkError);
    }
  });

  it('keeps showing a resolved notice for 30 days', () => {
    expect(Notice.resolvedShownSince(NOW)).toEqual(
      new Date('2026-09-01T09:00:00.000Z'),
    );
  });

  it('rejects a stored notice resolved before it was created', () => {
    const notice = created();
    const state = {
      id: notice.id,
      workspaceId: notice.workspaceId,
      teamId: notice.teamId,
      addressee: notice.addressee,
      form: notice.form,
      subject: notice.subject,
      link: notice.link,
      externalLink: notice.externalLink,
      wording: notice.wording,
      createdAt: NOW,
      resolvedAt: null,
      version: 1,
    };

    expect(Notice.rehydrate(state).version).toBe(1);
    expect(() => Notice.rehydrate({ ...state, resolvedAt: later(-1) })).toThrow(
      InconsistentStateError,
    );
  });
});
