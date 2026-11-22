import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  InboxRequest,
  type InboxRequestVisibility,
} from '@work/domain/aggregates/inbox-request.aggregate';
import { InvalidInboxRequestError } from '@work/domain/exceptions/invalid-inbox-request.error';
import { inboxRequestForm } from '@work/domain/value-objects/inbox-request-form';
import { InboxRequestId } from '@work/domain/value-objects/inbox-request-id.vo';
import { InboxRequestRead } from '@work/domain/value-objects/inbox-request-read.vo';
import { InboxRequestSubject } from '@work/domain/value-objects/inbox-request-subject.vo';
import { TeamStanding } from '@work/domain/value-objects/team-standing.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-27T10:00:00.000Z');
const LATER = new Date('2026-09-27T11:00:00.000Z');
const ADA = UserId.of('user_ada');
const BEA = UserId.of('user_bea');
const MEMBER = TeamStanding.of({
  seesTeam: true,
  actsOnTeam: true,
  memberOfTeam: true,
});
const ADMIN = TeamStanding.of({
  seesTeam: true,
  actsOnTeam: true,
  memberOfTeam: false,
});
const SEES = TeamStanding.of({
  seesTeam: true,
  actsOnTeam: false,
  memberOfTeam: false,
});
const OUTSIDE = TeamStanding.outside();

const created = (
  change: { form?: string; about?: string; askedOf?: UserId } = {},
) =>
  InboxRequest.create({
    id: InboxRequestId.of('request_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    taskId: TaskId.of('task_1'),
    form: inboxRequestForm(change.form ?? 'memories'),
    about: InboxRequestSubject.of(change.about ?? ' run_1 '),
    askedOf: change.askedOf ?? null,
    now: NOW,
  });

describe('InboxRequest', () => {
  it('is created open and unread, about what it names', () => {
    const inboxRequest = created();

    expect(inboxRequest.open).toBe(true);
    expect(inboxRequest.unreadBy(ADA)).toBe(true);
    expect(inboxRequest.about.value).toBe('run_1');
  });

  it('rejects a form it does not know, or nothing to be about', () => {
    expect(() => created({ form: 'gossip' })).toThrow(InvalidInboxRequestError);
    expect(() => created({ about: '  ' })).toThrow(InvalidInboxRequestError);
  });

  it('resolves once, and stays resolved', () => {
    const resolved = created().resolve(LATER);

    expect(resolved.open).toBe(false);
    expect(resolved.resolvedAt).toEqual(LATER);
    expect(resolved.resolve(NOW)).toBe(resolved);
  });

  it('reopens unread once resolved, opened again but created when it was, and leaves an open inbox request as it is', () => {
    const resolved = created().readBy(ADA, NOW).resolve(NOW);

    const reopened = resolved.reopen(LATER);

    expect(reopened.open).toBe(true);
    expect(reopened.openedAt).toEqual(LATER);
    expect(reopened.createdAt).toEqual(resolved.createdAt);
    expect(reopened.unreadBy(ADA)).toBe(true);
    expect(reopened.reopen(LATER)).toBe(reopened);
  });

  it('records nothing of a reopening resolved before it was published', () => {
    const resolvedAgain = created()
      .resolve(NOW)
      .reopen(LATER)
      .resolve(LATER)
      .pullEvents()
      .map((each) => each.kind);

    expect(resolvedAgain).not.toContain('inbox-request.reopened');
  });

  it('records that it opened, and that it reopened', () => {
    expect(
      created()
        .pullEvents()
        .map((each) => each.kind),
    ).toEqual(['inbox-request.opened']);
    expect(
      created()
        .resolve(NOW)
        .reopen(LATER)
        .pullEvents()
        .map((each) => each.kind),
    ).toEqual(['inbox-request.resolved', 'inbox-request.reopened']);
  });

  it('is read by each person for themselves, once', () => {
    const read = created().readBy(ADA, LATER);

    expect(read.unreadBy(ADA)).toBe(false);
    expect(read.unreadBy(BEA)).toBe(true);
    expect(read.readBy(ADA, NOW)).toBe(read);
    expect(read.readBy(BEA, NOW).reads.map((each) => each.by.value)).toEqual([
      'user_ada',
      'user_bea',
    ]);
  });

  it('counts as read for everyone once resolved, as the inbox shows it', () => {
    const resolved = created().resolve(NOW);

    expect(resolved.unreadBy(BEA)).toBe(false);
    expect(
      InboxRequest.unread({ readAt: null, resolvedAt: resolved.resolvedAt }),
    ).toBe(false);
    expect(InboxRequest.unread({ readAt: null, resolvedAt: null })).toBe(true);
  });

  describe('rehydrating', () => {
    const rehydrated = (reads: InboxRequestRead[]) =>
      InboxRequest.rehydrate({
        id: InboxRequestId.of('request_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        taskId: TaskId.of('task_1'),
        form: 'memories',
        about: InboxRequestSubject.of('run_1'),
        askedOf: null,
        createdAt: NOW,
        openedAt: LATER,
        reads,
        resolvedAt: null,
        version: 1,
      });

    it('rejects a read before it was opened', () => {
      expect(() =>
        rehydrated([InboxRequestRead.of({ by: ADA, at: NOW })]),
      ).toThrow(InconsistentStateError);
    });

    it('rejects being opened before it was created', () => {
      expect(() =>
        InboxRequest.rehydrate({
          id: InboxRequestId.of('request_1'),
          workspaceId: WorkspaceId.of('ws_1'),
          taskId: TaskId.of('task_1'),
          form: 'memories',
          about: InboxRequestSubject.of('run_1'),
          askedOf: null,
          createdAt: LATER,
          openedAt: NOW,
          reads: [],
          resolvedAt: null,
          version: 1,
        }),
      ).toThrow(InconsistentStateError);
    });

    it('rejects two reads by one person', () => {
      expect(() =>
        rehydrated([
          InboxRequestRead.of({ by: ADA, at: LATER }),
          InboxRequestRead.of({ by: ADA, at: LATER }),
        ]),
      ).toThrow(InconsistentStateError);
    });
  });

  describe('who sees it', () => {
    const attending = (
      change: Partial<Omit<InboxRequestVisibility, 'team'>>,
      team: TeamStanding = MEMBER,
    ) =>
      InboxRequest.visibleTo({
        form: 'memories',
        viewer: BEA,
        assignee: null,
        askedOf: null,
        team,
        ...change,
      });

    it('is the task’s assignee, and nobody else, while the task has one', () => {
      expect(attending({ viewer: ADA, assignee: ADA }, OUTSIDE)).toBe(true);
      expect(attending({ viewer: BEA, assignee: ADA })).toBe(false);
    });

    it('is anyone who sees the task’s team while nobody is assigned, whether or not they read the team’s insights', () => {
      expect(attending({}, SEES)).toBe(true);
      expect(attending({}, OUTSIDE)).toBe(false);
    });

    it('creates an alert for everyone who acts on the team, whoever the task is assigned to', () => {
      expect(attending({ form: 'alert' }, ADMIN)).toBe(true);
      expect(attending({ form: 'alert', viewer: BEA, assignee: ADA })).toBe(
        true,
      );
      expect(attending({ form: 'alert' }, SEES)).toBe(false);
      expect(
        attending({ form: 'alert', viewer: ADA, assignee: ADA }, SEES),
      ).toBe(false);
    });

    it('is only the person it asks, while that person sees the team', () => {
      const asked = { form: 'judge-disagreement', askedOf: ADA } as const;

      expect(attending({ ...asked, viewer: ADA, assignee: BEA })).toBe(true);
      expect(attending({ ...asked, viewer: BEA, assignee: BEA })).toBe(false);
      expect(attending({ ...asked, viewer: BEA })).toBe(false);
      expect(attending({ ...asked, viewer: ADA }, OUTSIDE)).toBe(false);
    });

    it('needs only the access its form requires', () => {
      expect(InboxRequest.requiredAccess('memories')).toBe('seesTasks');
      expect(InboxRequest.requiredAccess('alert')).toBe('actsOnTasks');
      expect(InboxRequest.requiredAccess('judge-disagreement')).toBe(
        'seesTasks',
      );
    });
  });

  describe('how it reaches a person', () => {
    const seen = (
      assignee: UserId | null,
      team: TeamStanding,
      askedOf: UserId | null = null,
    ) =>
      InboxRequest.standingOf({
        form: 'memories',
        viewer: ADA,
        assignee,
        askedOf,
        team,
      });

    it('reaches its assignee as the assignee', () => {
      expect(seen(ADA, SEES)).toBe('assignee');
    });

    it('reaches a member of the team while nobody is the assignee', () => {
      expect(seen(null, MEMBER)).toBe('team');
    });

    it('reaches a workspace admin who is not on the team as neither, like a question with no assignee', () => {
      expect(seen(null, ADMIN)).toBeNull();
    });

    it('reaches a person who only sees the team as neither', () => {
      expect(seen(null, SEES)).toBeNull();
    });

    it('reaches every person who acts on the team with an alert while nobody is the assignee, a workspace admin too', () => {
      const alerted = (team: TeamStanding) =>
        InboxRequest.standingOf({
          form: 'alert',
          viewer: ADA,
          assignee: null,
          askedOf: null,
          team,
        });

      expect(alerted(MEMBER)).toBe('team');
      expect(alerted(ADMIN)).toBe('team');
      expect(alerted(SEES)).toBeNull();
    });

    it('reaches nobody else as the assignee or the team', () => {
      expect(seen(BEA, MEMBER)).toBeNull();
    });

    it('reaches only the person it asks, as the assignee', () => {
      expect(seen(BEA, MEMBER, ADA)).toBe('assignee');
      expect(seen(ADA, MEMBER, BEA)).toBeNull();
      expect(seen(null, MEMBER, BEA)).toBeNull();
    });
  });

  describe('who can resolve or reopen it', () => {
    const ACTS = TeamStanding.of({
      seesTeam: true,
      actsOnTeam: true,
      memberOfTeam: true,
    });
    const SEES = TeamStanding.of({
      seesTeam: true,
      actsOnTeam: false,
      memberOfTeam: false,
    });

    it('lets a person who acts on the team resolve it while it is open', () => {
      expect(InboxRequest.resolvableBy(ACTS, null)).toBe(true);
      expect(InboxRequest.resolvableBy(ACTS, NOW)).toBe(false);
    });

    it('lets a person who acts on the team reopen it once it is resolved', () => {
      expect(InboxRequest.reopenableBy(ACTS, NOW)).toBe(true);
      expect(InboxRequest.reopenableBy(ACTS, null)).toBe(false);
    });

    it('lets nobody resolve or reopen it who only sees the team', () => {
      expect(InboxRequest.resolvableBy(SEES, null)).toBe(false);
      expect(InboxRequest.reopenableBy(SEES, NOW)).toBe(false);
    });
  });
});
