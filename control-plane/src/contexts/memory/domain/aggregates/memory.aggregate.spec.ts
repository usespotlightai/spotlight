import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { MemoryRetired } from '@memory/domain/events/memory-retired.event';
import { MemoryStood } from '@memory/domain/events/memory-stood.event';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { MemoryAlreadyRetiredError } from '@memory/domain/exceptions/memory-already-retired.error';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryGrounds } from '@memory/domain/value-objects/memory-grounds.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-27T10:00:00.000Z');
const LATER = new Date('2026-09-27T11:00:00.000Z');
const OLD = MemoryId.of('memory_old');
const NEW = MemoryId.of('memory_new');

const TEAM = TeamId.of('team_1');

const stood = (
  change: {
    id?: MemoryId;
    supersedes?: Memory | null;
    scope?: MemoryScope;
  } = {},
) =>
  Memory.stood({
    id: change.id ?? NEW,
    handle: MemoryHandle.of(1),
    workspaceId: WorkspaceId.of('ws_1'),
    kind: 'preference',
    body: MemoryBody.of(' Name branches after the ticket. '),
    scope: change.scope ?? MemoryScope.of({ teamId: TEAM }),
    grounds: MemoryGrounds.of({
      taskId: TaskId.of('task_1'),
      runId: RunId.of('run_1'),
      steps: [],
      notes: [2],
    }),
    source: 'person',
    supersedes: change.supersedes ?? null,
    approval: MemoryDecision.of({ by: UserId.of('user_ada'), at: NOW }),
  });

const old = () => stood({ id: OLD });

describe('Memory', () => {
  it('stands once approved, saying what it supersedes', () => {
    const memory = stood({ supersedes: old() });

    expect(memory.standing).toBe('stands');
    expect(memory.body.value).toBe('Name branches after the ticket.');
    expect(memory.pullEvents()).toEqual([new MemoryStood(NEW, OLD)]);
  });

  it('supersedes only a memory that still stands', () => {
    const retired = old().retire({
      by: UserId.of('user_bea'),
      reason: 'Wrong.',
      at: LATER,
    });

    expect(stood({ supersedes: retired }).supersedes).toBeNull();
  });

  it('refuses superseding itself', () => {
    expect(() => stood({ supersedes: stood() })).toThrow(InvalidMemoryError);
  });

  it('applies only where its scope reaches, and only while it stands', () => {
    const api = Repository.of('acme/api');
    const site = {
      teamId: TEAM,
      lineId: 'line_1',
      stationId: 'station_1',
      repositories: [api],
    };
    const atLine = stood({
      scope: MemoryScope.of({ teamId: TEAM, lineId: 'line_1' }),
    });

    expect(atLine.appliesAt(site)).toBe(true);
    expect(atLine.appliesAt({ ...site, lineId: 'line_2' })).toBe(false);
    expect(
      atLine
        .retire({ by: UserId.of('user_bea'), reason: 'Gone.', at: LATER })
        .appliesAt(site),
    ).toBe(false);
  });

  it('retires when a newer memory supersedes it, and says by which', () => {
    const memory = stood();
    memory.pullEvents();

    const retired = memory.supersedeWith(OLD, LATER);

    expect(retired.standing).toBe('retired');
    expect(retired.retirement?.supersededBy?.equals(OLD)).toBe(true);
    expect(retired.retirement?.at).toEqual(LATER);
    expect(retired.pullEvents()).toEqual([new MemoryRetired(NEW, OLD)]);
  });

  it('retires once', () => {
    const retired = stood().supersedeWith(OLD, LATER);

    expect(retired.supersedeWith(MemoryId.of('memory_other'), NOW)).toBe(
      retired,
    );
  });

  it('stands at once when a person writes it, as theirs and resting on nothing', () => {
    const written = Memory.write({
      id: NEW,
      handle: MemoryHandle.of(2),
      workspaceId: WorkspaceId.of('ws_1'),
      kind: 'environment',
      body: MemoryBody.of('Staging needs a restart after deploys.'),
      scope: MemoryScope.of({ teamId: TEAM }),
      grounds: null,
      by: MemoryDecision.of({ by: UserId.of('user_bea'), at: NOW }),
    });

    expect(written.standing).toBe('stands');
    expect(written.source).toBe('person');
    expect(written.grounds).toBeNull();
    expect(written.approval.by.value).toBe('user_bea');
  });

  it('retires with a reason, saying who retired it', () => {
    const retired = stood().retire({
      by: UserId.of('user_bea'),
      reason: ' The retry worker was removed. ',
      at: LATER,
    });

    expect(retired.standing).toBe('retired');
    expect(retired.retirement?.reason).toBe('The retry worker was removed.');
    expect(retired.retirement?.by?.value).toBe('user_bea');
    expect(retired.retirement?.supersededBy).toBeNull();
  });

  it('refuses to retire without a reason, or twice', () => {
    expect(() =>
      stood().retire({ by: UserId.of('user_bea'), reason: '  ', at: LATER }),
    ).toThrow(InvalidMemoryError);

    const retired = stood().retire({
      by: UserId.of('user_bea'),
      reason: 'Gone.',
      at: LATER,
    });
    expect(() =>
      retired.retire({
        by: UserId.of('user_bea'),
        reason: 'Again.',
        at: LATER,
      }),
    ).toThrow(MemoryAlreadyRetiredError);
  });

  it('is corrected by a successor that keeps what it rests on and stands to supersede it, leaving it untouched', () => {
    const original = stood();
    original.pullEvents();

    const successor = original.correct({
      id: OLD,
      handle: MemoryHandle.of(3),
      kind: 'preference',
      body: MemoryBody.of('Name branches after the ticket number.'),
      scope: MemoryScope.of({ teamId: TEAM }),
      by: MemoryDecision.of({ by: UserId.of('user_bea'), at: LATER }),
    });

    expect(original.standing).toBe('stands');
    expect(original.pullEvents()).toEqual([]);
    expect(successor.supersedes?.equals(NEW)).toBe(true);
    expect(successor.source).toBe('person');
    expect(successor.grounds?.equals(original.grounds as MemoryGrounds)).toBe(
      true,
    );
    expect(successor.pullEvents()).toEqual([new MemoryStood(OLD, NEW)]);
  });

  it('refuses to correct a memory that was already retired', () => {
    const retired = stood().retire({
      by: UserId.of('user_bea'),
      reason: 'Gone.',
      at: LATER,
    });

    expect(() =>
      retired.correct({
        id: OLD,
        handle: MemoryHandle.of(4),
        kind: 'preference',
        body: MemoryBody.of('Again.'),
        scope: MemoryScope.of({ teamId: TEAM }),
        by: MemoryDecision.of({ by: UserId.of('user_bea'), at: LATER }),
      }),
    ).toThrow(MemoryAlreadyRetiredError);
  });
});
