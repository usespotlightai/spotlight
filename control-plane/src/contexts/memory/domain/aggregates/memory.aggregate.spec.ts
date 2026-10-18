import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { MemoryCreated } from '@memory/domain/events/memory-created.event';
import { MemoryRetired } from '@memory/domain/events/memory-retired.event';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { MemoryAlreadyRetiredError } from '@memory/domain/exceptions/memory-already-retired.error';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryProvenance } from '@memory/domain/value-objects/memory-provenance.vo';
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

const created = (
  change: {
    id?: MemoryId;
    supersedes?: Memory | null;
    scope?: MemoryScope;
  } = {},
) =>
  Memory.create({
    id: change.id ?? NEW,
    handle: MemoryHandle.of(1),
    workspaceId: WorkspaceId.of('ws_1'),
    kind: 'preference',
    body: MemoryBody.of(' Name branches after the ticket. '),
    scope: change.scope ?? MemoryScope.of({ teamId: TEAM }),
    provenance: MemoryProvenance.of({
      taskId: TaskId.of('task_1'),
      runId: RunId.of('run_1'),
      steps: [],
      notes: [2],
    }),
    source: 'person',
    supersedes: change.supersedes ?? null,
    approval: MemoryDecision.of({ by: UserId.of('user_ada'), at: NOW }),
  });

const old = () => created({ id: OLD });

describe('Memory', () => {
  it('is active once approved and says what it supersedes', () => {
    const memory = created({ supersedes: old() });

    expect(memory.status).toBe('active');
    expect(memory.body.value).toBe('Name branches after the ticket.');
    expect(memory.pullEvents()).toEqual([new MemoryCreated(NEW, OLD)]);
  });

  it('supersedes only a memory that is still active', () => {
    const retired = old().retire({
      by: UserId.of('user_bea'),
      reason: 'Wrong.',
      at: LATER,
    });

    expect(created({ supersedes: retired }).supersedes).toBeNull();
  });

  it('rejects superseding itself', () => {
    expect(() => created({ supersedes: created() })).toThrow(
      InvalidMemoryError,
    );
  });

  it('applies only where its scope matches, and only while it is active', () => {
    const api = Repository.of('acme/api');
    const runContext = {
      teamId: TEAM,
      lineId: 'line_1',
      stationId: 'station_1',
      repositories: [api],
    };
    const atLine = created({
      scope: MemoryScope.of({ teamId: TEAM, lineId: 'line_1' }),
    });

    expect(atLine.appliesAt(runContext)).toBe(true);
    expect(atLine.appliesAt({ ...runContext, lineId: 'line_2' })).toBe(false);
    expect(
      atLine
        .retire({ by: UserId.of('user_bea'), reason: 'Gone.', at: LATER })
        .appliesAt(runContext),
    ).toBe(false);
  });

  it('retires when a newer memory supersedes it, and says by which', () => {
    const memory = created();
    memory.pullEvents();

    const retired = memory.supersedeWith(OLD, LATER);

    expect(retired.status).toBe('retired');
    expect(retired.retirement?.supersededBy?.equals(OLD)).toBe(true);
    expect(retired.retirement?.at).toEqual(LATER);
    expect(retired.pullEvents()).toEqual([new MemoryRetired(NEW, OLD)]);
  });

  it('retires once', () => {
    const retired = created().supersedeWith(OLD, LATER);

    expect(retired.supersedeWith(MemoryId.of('memory_other'), NOW)).toBe(
      retired,
    );
  });

  it('is active at once when a person writes it, as theirs and citing nothing', () => {
    const written = Memory.write({
      id: NEW,
      handle: MemoryHandle.of(2),
      workspaceId: WorkspaceId.of('ws_1'),
      kind: 'environment',
      body: MemoryBody.of('Staging needs a restart after deploys.'),
      scope: MemoryScope.of({ teamId: TEAM }),
      provenance: null,
      by: MemoryDecision.of({ by: UserId.of('user_bea'), at: NOW }),
    });

    expect(written.status).toBe('active');
    expect(written.source).toBe('person');
    expect(written.provenance).toBeNull();
    expect(written.approval.by.value).toBe('user_bea');
  });

  it('retires with a reason, saying who retired it', () => {
    const retired = created().retire({
      by: UserId.of('user_bea'),
      reason: ' The retry worker was removed. ',
      at: LATER,
    });

    expect(retired.status).toBe('retired');
    expect(retired.retirement?.reason).toBe('The retry worker was removed.');
    expect(retired.retirement?.by?.value).toBe('user_bea');
    expect(retired.retirement?.supersededBy).toBeNull();
  });

  it('does not retire without a reason, or twice', () => {
    expect(() =>
      created().retire({ by: UserId.of('user_bea'), reason: '  ', at: LATER }),
    ).toThrow(InvalidMemoryError);

    const retired = created().retire({
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

  it('is corrected by a successor that keeps what it cites and becomes active to supersede it, leaving it untouched', () => {
    const original = created();
    original.pullEvents();

    const successor = original.correct({
      id: OLD,
      handle: MemoryHandle.of(3),
      kind: 'preference',
      body: MemoryBody.of('Name branches after the ticket number.'),
      scope: MemoryScope.of({ teamId: TEAM }),
      by: MemoryDecision.of({ by: UserId.of('user_bea'), at: LATER }),
    });

    expect(original.status).toBe('active');
    expect(original.pullEvents()).toEqual([]);
    expect(successor.supersedes?.equals(NEW)).toBe(true);
    expect(successor.source).toBe('person');
    expect(
      successor.provenance?.equals(original.provenance as MemoryProvenance),
    ).toBe(true);
    expect(successor.pullEvents()).toEqual([new MemoryCreated(OLD, NEW)]);
  });

  it('does not correct a memory that was already retired', () => {
    const retired = created().retire({
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
