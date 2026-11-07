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
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-27T10:00:00.000Z');
const LATER = new Date('2026-09-27T11:00:00.000Z');
const ADA = UserId.of('user_ada');
const BEA = UserId.of('user_bea');

const created = (change: { form?: string; about?: string } = {}) =>
  InboxRequest.create({
    id: InboxRequestId.of('request_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    taskId: TaskId.of('task_1'),
    form: inboxRequestForm(change.form ?? 'memories'),
    about: InboxRequestSubject.of(change.about ?? ' run_1 '),
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
    resolved.pullEvents();

    expect(resolved.open).toBe(false);
    expect(resolved.resolvedAt).toEqual(LATER);
    expect(resolved.resolve(NOW)).toBe(resolved);
  });

  it('reopens unread once resolved, opened again but created when it was, and leaves an open inbox request as it is', () => {
    const resolved = created().readBy(ADA, NOW).resolve(NOW);
    resolved.pullEvents();

    const reopened = resolved.reopen(LATER);

    expect(reopened.open).toBe(true);
    expect(reopened.openedAt).toEqual(LATER);
    expect(reopened.createdAt).toEqual(resolved.createdAt);
    expect(reopened.unreadBy(ADA)).toBe(true);
    expect(reopened.reopen(LATER)).toBe(reopened);
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
    const attending = (change: Partial<InboxRequestVisibility>) =>
      InboxRequest.visibleTo({
        form: 'memories',
        viewer: BEA,
        assignee: null,
        seesTeam: true,
        readsTeamInsights: true,
        ...change,
      });

    it('is the task’s assignee, and nobody else, while the task has one', () => {
      expect(attending({ viewer: ADA, assignee: ADA, seesTeam: false })).toBe(
        true,
      );
      expect(attending({ viewer: BEA, assignee: ADA })).toBe(false);
    });

    it('is anyone who sees the task’s team while nobody is assigned, whether or not they read the team’s insights', () => {
      expect(attending({ readsTeamInsights: false })).toBe(true);
      expect(attending({ seesTeam: false })).toBe(false);
    });

    it('asks a grade of everyone who reads the team’s insights, whoever the task is assigned to', () => {
      expect(attending({ form: 'grade', seesTeam: false })).toBe(true);
      expect(attending({ form: 'grade', viewer: BEA, assignee: ADA })).toBe(
        true,
      );
      expect(attending({ form: 'grade', readsTeamInsights: false })).toBe(
        false,
      );
      expect(
        attending({
          form: 'grade',
          viewer: ADA,
          assignee: ADA,
          readsTeamInsights: false,
        }),
      ).toBe(false);
    });

    it('creates an alert for everyone who reads the team’s insights, whoever the task is assigned to', () => {
      expect(attending({ form: 'alert', seesTeam: false })).toBe(true);
      expect(attending({ form: 'alert', viewer: BEA, assignee: ADA })).toBe(
        true,
      );
      expect(attending({ form: 'alert', readsTeamInsights: false })).toBe(
        false,
      );
      expect(
        attending({
          form: 'alert',
          viewer: ADA,
          assignee: ADA,
          readsTeamInsights: false,
        }),
      ).toBe(false);
    });

    it('needs only the access its form requires', () => {
      expect(InboxRequest.requiredAccess('memories')).toBe('seesTeam');
      expect(InboxRequest.requiredAccess('grade')).toBe('readsTeamInsights');
      expect(InboxRequest.requiredAccess('alert')).toBe('readsTeamInsights');
    });
  });
});
