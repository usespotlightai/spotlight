import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { TaskAside } from '@work/domain/aggregates/task-aside.aggregate';
import { TaskAsideRaised } from '@work/domain/events/task-aside-raised.event';
import { TaskAsideSettled } from '@work/domain/events/task-aside-settled.event';
import { InvalidTaskAsideError } from '@work/domain/exceptions/invalid-task-aside.error';
import { AsideRead } from '@work/domain/value-objects/aside-read.vo';
import { TaskAsideId } from '@work/domain/value-objects/task-aside-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-27T10:00:00.000Z');
const LATER = new Date('2026-09-27T11:00:00.000Z');
const ADA = UserId.of('user_ada');
const BEA = UserId.of('user_bea');

const raised = (change: { form?: string; about?: string } = {}) =>
  TaskAside.raised({
    id: TaskAsideId.of('aside_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    taskId: TaskId.of('task_1'),
    form: change.form ?? 'memories',
    about: change.about ?? ' run_1 ',
    now: NOW,
  });

describe('TaskAside', () => {
  it('is raised open and unread, about what it names', () => {
    const aside = raised();

    expect(aside.open).toBe(true);
    expect(aside.unreadBy(ADA)).toBe(true);
    expect(aside.about).toBe('run_1');
    expect(aside.pullEvents()).toEqual([
      new TaskAsideRaised(aside.id, aside.taskId, 'memories', 'run_1'),
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
        about: 'run_1',
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
    it('is the task’s assignee, and nobody else, while the task has one', () => {
      expect(
        TaskAside.attendedBy({ viewer: ADA, assignee: ADA, onTeam: true }),
      ).toBe(true);
      expect(
        TaskAside.attendedBy({ viewer: BEA, assignee: ADA, onTeam: true }),
      ).toBe(false);
    });

    it('is anyone on the task’s team while nobody is assigned', () => {
      expect(
        TaskAside.attendedBy({ viewer: BEA, assignee: null, onTeam: true }),
      ).toBe(true);
      expect(
        TaskAside.attendedBy({ viewer: BEA, assignee: null, onTeam: false }),
      ).toBe(false);
    });
  });
});
