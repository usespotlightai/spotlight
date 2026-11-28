import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  Notice,
  type NoticeStanding,
} from '@work/domain/aggregates/notice.aggregate';
import { InvalidNoticeExternalLinkError } from '@work/domain/exceptions/invalid-notice-external-link.error';
import { InvalidNoticeError } from '@work/domain/exceptions/invalid-notice.error';
import { NoticeAutoResolveError } from '@work/domain/exceptions/notice-auto-resolve.error';
import { NoticeExternalLink } from '@work/domain/value-objects/notice-external-link.vo';
import { noticeForm } from '@work/domain/value-objects/notice-form';
import { NoticeId } from '@work/domain/value-objects/notice-id.vo';
import { NoticeLink } from '@work/domain/value-objects/notice-link.vo';
import { NoticeSubject } from '@work/domain/value-objects/notice-subject.vo';
import { NoticeWording } from '@work/domain/value-objects/notice-wording.vo';
import { TeamStanding } from '@work/domain/value-objects/team-standing.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-01T09:00:00.000Z');

const later = (ms: number) => new Date(NOW.getTime() + ms);

const PERSON = UserId.of('user_1');

const created = (
  subject = 'replay-search search_1 iteration 3',
  addressee: UserId | null = PERSON,
) =>
  Notice.create({
    id: NoticeId.of('notice_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    addressee,
    form: 'ended',
    subject: NoticeSubject.of(subject),
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
      points: ['Fix the claims.'],
    }),
    autoResolve: false,
    at: NOW,
  });

describe('Notice', () => {
  it('is open to the team only while open and addressed to nobody', () => {
    const unaddressed = created(undefined, null);

    expect(unaddressed.openToTeam).toBe(true);
    expect(created().openToTeam).toBe(false);
    expect(unaddressed.resolve(later(1)).openToTeam).toBe(false);
  });

  it('is created open, for one person only', () => {
    const notice = created();

    expect(notice.resolvedAt).toBeNull();
    expect(notice.version).toBe(0);
    expect(notice.isFor(PERSON)).toBe(true);
    expect(notice.isFor(UserId.of('user_2'))).toBe(false);
  });

  it('reopens once resolved, and leaves an open notice as it is', () => {
    const open = created();

    expect(open.resolve(later(3)).reopen(later(4)).resolvedAt).toBeNull();
    expect(open.reopen(later(4))).toBe(open);
  });

  it('records that it was raised, resolved and reopened', () => {
    const open = created();
    expect(open.pullEvents().map((each) => each.kind)).toEqual([
      'notice.raised',
    ]);

    const reopened = open.resolve(later(3)).reopen(later(4));

    expect(reopened.pullEvents().map((each) => each.kind)).toEqual([
      'notice.resolved',
      'notice.reopened',
    ]);
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
      autoResolve: false,
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

describe('who can resolve or reopen a notice', () => {
  const ACTS: NoticeStanding = {
    kind: 'team',
    team: TeamStanding.of({
      seesTeam: true,
      actsOnTeam: true,
      memberOfTeam: true,
    }),
  };
  const SEES: NoticeStanding = {
    kind: 'team',
    team: TeamStanding.of({
      seesTeam: true,
      actsOnTeam: false,
      memberOfTeam: false,
    }),
  };
  const AT = new Date('2026-11-20T09:00:00.000Z');

  const OPEN = { resolvedAt: null, autoResolve: false };
  const RESOLVED = { resolvedAt: AT, autoResolve: false };

  it('lets a person who acts on the team resolve it while it is open', () => {
    expect(Notice.resolvableBy(ACTS, OPEN)).toBe(true);
    expect(Notice.resolvableBy(ACTS, RESOLVED)).toBe(false);
  });

  it('lets a person who acts on the team reopen it once it is resolved', () => {
    expect(Notice.reopenableBy(ACTS, RESOLVED)).toBe(true);
    expect(Notice.reopenableBy(ACTS, OPEN)).toBe(false);
  });

  it('lets nobody resolve or reopen it who only sees the team', () => {
    expect(Notice.resolvableBy(SEES, OPEN)).toBe(false);
    expect(Notice.reopenableBy(SEES, RESOLVED)).toBe(false);
  });

  it('lets nobody resolve or reopen a notice that resolves itself', () => {
    const admin: NoticeStanding = { kind: 'workspace', isAdmin: true };

    for (const standing of [ACTS, admin]) {
      expect(
        Notice.resolvableBy(standing, { ...OPEN, autoResolve: true }),
      ).toBe(false);
      expect(
        Notice.reopenableBy(standing, { ...RESOLVED, autoResolve: true }),
      ).toBe(false);
    }
  });

  it('lets only an owner or admin resolve or reopen a notice about the whole workspace', () => {
    const admin: NoticeStanding = { kind: 'workspace', isAdmin: true };
    const member: NoticeStanding = { kind: 'workspace', isAdmin: false };
    const unseen = () => new Error('unseen');

    expect(Notice.resolvableBy(admin, OPEN)).toBe(true);
    expect(Notice.reopenableBy(admin, RESOLVED)).toBe(true);
    expect(Notice.resolvableBy(member, OPEN)).toBe(false);
    expect(() => {
      Notice.assertActedOnBy(member, unseen);
    }).toThrow('unseen');
  });
});

describe('a notice about the whole workspace', () => {
  const aboutWorkspace = (addressee: UserId | null, autoResolve = false) =>
    Notice.create({
      id: NoticeId.of('notice_ws'),
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: null,
      addressee,
      form: 'advice',
      subject: NoticeSubject.of('host-outage pool:pool_1'),
      link: NoticeLink.of({ path: 'settings/runners', label: 'Open runners' }),
      externalLink: null,
      wording: NoticeWording.of({
        headline: 'dev-host is offline',
        points: ['Start a host.'],
      }),
      autoResolve,
      at: new Date('2026-11-27T20:05:00.000Z'),
    });

  it('goes to the owners and admins, and to nobody else, whatever teams they see', () => {
    const shown = (isAdmin: boolean) =>
      Notice.shownTo({
        teamId: null,
        addressee: null,
        person: UserId.of('user_1'),
        teamsSeen: new Set(['team_1']),
        isAdmin,
      });

    expect(shown(true)).toBe(true);
    expect(shown(false)).toBe(false);
    expect(aboutWorkspace(null).openToTeam).toBe(false);
  });

  it('has no addressee', () => {
    expect(() => aboutWorkspace(UserId.of('user_1'))).toThrow(
      InvalidNoticeError,
    );
  });

  it('always reaches the workspace, needing no team', () => {
    expect(
      Notice.deliverable({
        aboutWorkspace: true,
        teamExists: false,
        addressee: null,
        addresseeSeesTeam: false,
      }),
    ).toBe(true);
  });

  it('stays open, when it resolves itself, until Spotlight resolves it, and a person can neither resolve nor reopen it', () => {
    const outage = aboutWorkspace(null, true);
    const at = new Date('2026-11-27T20:06:00.000Z');

    expect(outage.autoResolve).toBe(true);
    expect(() => outage.resolveByPerson(at)).toThrow(NoticeAutoResolveError);
    expect(outage.resolvedAt).toBeNull();

    const resolved = outage.resolve(at);

    expect(resolved.resolvedAt).toEqual(at);
    expect(() => resolved.reopen(at)).toThrow(NoticeAutoResolveError);
  });

  it('lets a person resolve it by hand when it does not resolve itself', () => {
    const at = new Date('2026-11-27T20:06:00.000Z');

    expect(aboutWorkspace(null).resolveByPerson(at).resolvedAt).toEqual(at);
  });
});
