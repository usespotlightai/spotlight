import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  InboxRequest,
  type InboxRequestVisibility,
} from '@work/domain/aggregates/inbox-request.aggregate';
import { InboxRequestCreated } from '@work/domain/events/inbox-request-created.event';
import { InboxRequestResolved } from '@work/domain/events/inbox-request-resolved.event';
import { InvalidInboxRequestError } from '@work/domain/exceptions/invalid-inbox-request.error';
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
    form: change.form ?? 'memories',
    about: InboxRequestSubject.of(change.about ?? ' run_1 '),
    now: NOW,
  });

describe('InboxRequest', () => {
  it('is created open and unread, about what it names', () => {
    const inboxRequest = created();

    expect(inboxRequest.open).toBe(true);
    expect(inboxRequest.unreadBy(ADA)).toBe(true);
    expect(inboxRequest.about.value).toBe('run_1');
    expect(inboxRequest.pullEvents()).toEqual([
      new InboxRequestCreated(
        inboxRequest.id,
        inboxRequest.taskId,
        'memories',
        InboxRequestSubject.of('run_1'),
      ),
    ]);
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

  it('reopens unread once resolved, says it was created again, and leaves an open inbox request as it is', () => {
    const resolved = created().readBy(ADA, NOW).resolve(NOW);
    resolved.pullEvents();

    const reopened = resolved.reopen(LATER);

    expect(reopened.open).toBe(true);
    expect(reopened.createdAt).toEqual(LATER);
    expect(reopened.unreadBy(ADA)).toBe(true);
    expect(reopened.pullEvents()).toEqual([
      new InboxRequestCreated(
        reopened.id,
        reopened.taskId,
        'memories',
        InboxRequestSubject.of('run_1'),
      ),
    ]);
    expect(reopened.reopen(LATER)).toBe(reopened);
  });

  it('says it is resolved', () => {
    const inboxRequest = created();
    inboxRequest.pullEvents();

    expect(inboxRequest.resolve(LATER).pullEvents()).toEqual([
      new InboxRequestResolved(inboxRequest.id, inboxRequest.taskId),
    ]);
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

  describe('rehydrating', () => {
    const rehydrated = (reads: InboxRequestRead[]) =>
      InboxRequest.rehydrate({
        id: InboxRequestId.of('request_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        taskId: TaskId.of('task_1'),
        form: 'memories',
        about: InboxRequestSubject.of('run_1'),
        createdAt: LATER,
        reads,
        resolvedAt: null,
        version: 1,
      });

    it('rejects a read before it was created', () => {
      expect(() =>
        rehydrated([InboxRequestRead.of({ by: ADA, at: NOW })]),
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
