import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  type AsideAttendance,
  TaskAside,
} from '@work/domain/aggregates/task-aside.aggregate';
import { TaskAsideRaised } from '@work/domain/events/task-aside-raised.event';
import { TaskAsideSettled } from '@work/domain/events/task-aside-settled.event';
import { InvalidTaskAsideError } from '@work/domain/exceptions/invalid-task-aside.error';
import { AsideAbout } from '@work/domain/value-objects/aside-about.vo';
import { AsideRead } from '@work/domain/value-objects/aside-read.vo';
import { TaskAsideId } from '@work/domain/value-objects/task-aside-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-27T10:00:00.000Z');
const LATER = new Date('2026-09-27T11:00:00.000Z');
const ADA = UserId.of('user_ada');
const BEA = UserId.of('user_bea');

const raised = (change: { form?: string; about?: string } = {}) =>
  TaskAside.raise({
    id: TaskAsideId.of('aside_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    taskId: TaskId.of('task_1'),
    form: change.form ?? 'memories',
    about: AsideAbout.of(change.about ?? ' run_1 '),
    now: NOW,
  });

describe('TaskAside', () => {
  it('is raised open and unread, about what it names', () => {
    const aside = raised();

    expect(aside.open).toBe(true);
    expect(aside.unreadBy(ADA)).toBe(true);
    expect(aside.about.value).toBe('run_1');
    expect(aside.pullEvents()).toEqual([
      new TaskAsideRaised(
        aside.id,
        aside.taskId,
        'memories',
        AsideAbout.of('run_1'),
      ),
    ]);
  });

  it('refuses a form it does not know, or nothing to be about', () => {
    expect(() => raised({ form: 'gossip' })).toThrow(InvalidTaskAsideError);
    expect(() => raised({ about: '  ' })).toThrow(InvalidTaskAsideError);
  });

  it('settles once, and stays settled', () => {
    const settled = raised().settled(LATER);
    settled.pullEvents();

    expect(settled.open).toBe(false);
    expect(settled.settledAt).toEqual(LATER);
    expect(settled.settled(NOW)).toBe(settled);
  });

  it('reopens unread once settled, says it was raised again, and leaves an open aside be', () => {
    const settled = raised().readBy(ADA, NOW).settled(NOW);
    settled.pullEvents();

    const reopened = settled.reopen(LATER);

    expect(reopened.open).toBe(true);
    expect(reopened.raisedAt).toEqual(LATER);
    expect(reopened.unreadBy(ADA)).toBe(true);
    expect(reopened.pullEvents()).toEqual([
      new TaskAsideRaised(
        reopened.id,
        reopened.taskId,
        'memories',
        AsideAbout.of('run_1'),
      ),
    ]);
    expect(reopened.reopen(LATER)).toBe(reopened);
  });

  it('says it settled', () => {
    const aside = raised();
    aside.pullEvents();

    expect(aside.settled(LATER).pullEvents()).toEqual([
      new TaskAsideSettled(aside.id, aside.taskId),
    ]);
  });

  it('is read by each person for themselves, once', () => {
    const read = raised().readBy(ADA, LATER);

    expect(read.unreadBy(ADA)).toBe(false);
    expect(read.unreadBy(BEA)).toBe(true);
    expect(read.readBy(ADA, NOW)).toBe(read);
    expect(read.readBy(BEA, NOW).reads.map((each) => each.by.value)).toEqual([
      'user_ada',
      'user_bea',
    ]);
  });

  describe('rehydrating', () => {
    const held = (reads: AsideRead[]) =>
      TaskAside.rehydrate({
        id: TaskAsideId.of('aside_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        taskId: TaskId.of('task_1'),
        form: 'memories',
        about: AsideAbout.of('run_1'),
        raisedAt: LATER,
        reads,
        settledAt: null,
        version: 1,
      });

    it('refuses a read before it was raised', () => {
      expect(() => held([AsideRead.of({ by: ADA, at: NOW })])).toThrow(
        InconsistentStateError,
      );
    });

    it('refuses two reads by one person', () => {
      expect(() =>
        held([
          AsideRead.of({ by: ADA, at: LATER }),
          AsideRead.of({ by: ADA, at: LATER }),
        ]),
      ).toThrow(InconsistentStateError);
    });
  });

  describe('who attends to it', () => {
    const attending = (change: Partial<AsideAttendance>) =>
      TaskAside.attendedBy({
        form: 'memories',
        viewer: BEA,
        assignee: null,
        seesTeam: true,
        readsTeamOutcomes: true,
        ...change,
      });

    it('is the task’s assignee, and nobody else, while the task has one', () => {
      expect(attending({ viewer: ADA, assignee: ADA, seesTeam: false })).toBe(
        true,
      );
      expect(attending({ viewer: BEA, assignee: ADA })).toBe(false);
    });

    it('is anyone who sees the task’s team while nobody is assigned, whether or not they read the team’s outcomes', () => {
      expect(attending({ readsTeamOutcomes: false })).toBe(true);
      expect(attending({ seesTeam: false })).toBe(false);
    });

    it('asks a grade of everyone who reads the team’s outcomes, whoever the task is assigned to', () => {
      expect(attending({ form: 'grade', seesTeam: false })).toBe(true);
      expect(attending({ form: 'grade', viewer: BEA, assignee: ADA })).toBe(
        true,
      );
      expect(attending({ form: 'grade', readsTeamOutcomes: false })).toBe(
        false,
      );
      expect(
        attending({
          form: 'grade',
          viewer: ADA,
          assignee: ADA,
          readsTeamOutcomes: false,
        }),
      ).toBe(false);
    });

    it('raises an alert to everyone who reads the team’s outcomes, whoever the task is assigned to', () => {
      expect(attending({ form: 'alert', seesTeam: false })).toBe(true);
      expect(attending({ form: 'alert', viewer: BEA, assignee: ADA })).toBe(
        true,
      );
      expect(attending({ form: 'alert', readsTeamOutcomes: false })).toBe(
        false,
      );
      expect(
        attending({
          form: 'alert',
          viewer: ADA,
          assignee: ADA,
          readsTeamOutcomes: false,
        }),
      ).toBe(false);
    });

    it('needs only the standing its form asks for', () => {
      expect(TaskAside.standingToAttend('memories')).toBe('seesTeam');
      expect(TaskAside.standingToAttend('grade')).toBe('readsTeamOutcomes');
      expect(TaskAside.standingToAttend('alert')).toBe('readsTeamOutcomes');
    });
  });
});
