import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Notice } from '@work/domain/aggregates/notice.aggregate';
import { InvalidNoticeError } from '@work/domain/exceptions/invalid-notice.error';
import { noticeForm } from '@work/domain/value-objects/notice-form';
import { NoticeId } from '@work/domain/value-objects/notice-id.vo';
import { NoticeLink } from '@work/domain/value-objects/notice-link.vo';
import { NoticeWording } from '@work/domain/value-objects/notice-wording.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-01T09:00:00.000Z');

const later = (ms: number) => new Date(NOW.getTime() + ms);

const PERSON = UserId.of('user_1');

const raised = (subject = 'replay-search search_1 iteration 3') =>
  Notice.raise({
    id: NoticeId.of('notice_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    addressee: PERSON,
    form: 'ended',
    subject,
    link: NoticeLink.of({
      path: 'lines/line_1/stations/station_1/searches/search_1',
      label: 'Open the search',
    }),
    wording: NoticeWording.of({
      headline: 'The search stalled',
      points: ['Fix the rubric.'],
    }),
    at: NOW,
  });

describe('Notice', () => {
  it('is raised open, for one person only', () => {
    const notice = raised();

    expect(notice.settledAt).toBeNull();
    expect(notice.version).toBe(0);
    expect(notice.isFor(PERSON)).toBe(true);
    expect(notice.isFor(UserId.of('user_2'))).toBe(false);
  });

  it('settles once', () => {
    const settled = raised().settled(later(3));

    expect(settled.settledAt).toEqual(later(3));
    expect(settled.settled(later(4))).toBe(settled);
  });

  it('refuses a subject it cannot name, a form it does not know, a link out of its team or unnamed, and wording out of bounds', () => {
    expect(() => raised(' ')).toThrow(InvalidNoticeError);
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

  it('keeps showing a settled notice for 30 days', () => {
    expect(Notice.settledShownSince(NOW)).toEqual(
      new Date('2026-09-01T09:00:00.000Z'),
    );
  });

  it('refuses a stored notice settled before it was raised', () => {
    const notice = raised();
    const state = {
      id: notice.id,
      workspaceId: notice.workspaceId,
      teamId: notice.teamId,
      addressee: notice.addressee,
      form: notice.form,
      subject: notice.subject,
      link: notice.link,
      wording: notice.wording,
      raisedAt: NOW,
      settledAt: null,
      version: 1,
    };

    expect(Notice.rehydrate(state).version).toBe(1);
    expect(() => Notice.rehydrate({ ...state, settledAt: later(-1) })).toThrow(
      InconsistentStateError,
    );
  });
});
