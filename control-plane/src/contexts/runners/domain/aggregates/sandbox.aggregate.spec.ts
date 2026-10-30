import { Sandbox } from '@runners/domain/aggregates/sandbox.aggregate';
import {
  aSandbox,
  DRAIN_POLICY,
  EDITOR_LIMIT_MS,
  GRACE_MS,
} from '@runners/domain/aggregates/sandbox.fake-spec';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { SandboxLease } from '@runners/domain/value-objects/sandbox-lease.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const STARTED_AT = new Date('2026-10-30T10:00:00.000Z');

const later = (ms: number): Date => new Date(STARTED_AT.getTime() + ms);

const HOST = HostId.of('01J8ZQ4Y7N3K5V2W9X6RTBHCDE');

const started = () =>
  aSandbox({
    workspaceId: WorkspaceId.of('ws_1'),
    hostId: HOST,
    at: STARTED_AT,
  });

const withLeases = (leases: SandboxLease[], idleSince: Date | null) => {
  const sandbox = started().reported();

  return Sandbox.rehydrate({
    id: sandbox.id,
    workspaceId: sandbox.workspaceId,
    key: sandbox.key,
    hostId: sandbox.hostId,
    state: sandbox.current,
    leases,
    idleSince,
    startedAt: sandbox.startedAt,
    goneAt: null,
    version: 0,
  });
};

describe('Sandbox', () => {
  it('starts for a run, held by that run, until its host reports it', () => {
    const sandbox = started();

    expect(sandbox.current).toBe('starting');
    expect(sandbox.holdsRun('run_1')).toBe(true);
    expect(sandbox.idleSince).toBeNull();
    expect(sandbox.reported().current).toBe('ready');
  });

  it('becomes idle when its run lets go of it, and ignores a run that does not hold it', () => {
    const sandbox = started().reported();

    expect(sandbox.releaseRun('run_2', later(1_000))).toBe(sandbox);

    const released = sandbox.releaseRun('run_1', later(1_000));

    expect(released.holdsRun('run_1')).toBe(false);
    expect(released.leases).toEqual([]);
    expect(released.idleSince).toEqual(later(1_000));
  });

  it('drains once it holds no lease for the grace, and not before', () => {
    const idle = started().reported().releaseRun('run_1', later(0));

    expect(idle.drainDue(DRAIN_POLICY, later(GRACE_MS - 1))).toBe(false);
    expect(idle.drainedWhenDue(DRAIN_POLICY, later(GRACE_MS - 1))).toBe(idle);
    expect(idle.drainedWhenDue(DRAIN_POLICY, later(GRACE_MS)).current).toBe(
      'draining',
    );
  });

  it('never drains while a run holds it', () => {
    const held = started().reported();

    expect(held.drainDue(DRAIN_POLICY, later(EDITOR_LIMIT_MS * 2))).toBe(false);
  });

  it('drains when only editors held it past the editor limit after its last run', () => {
    const edited = withLeases(
      [SandboxLease.of('editor', 'person_1', later(0))],
      later(0),
    );

    expect(edited.drainDue(DRAIN_POLICY, later(GRACE_MS))).toBe(false);
    expect(edited.drainDue(DRAIN_POLICY, later(EDITOR_LIMIT_MS - 1))).toBe(
      false,
    );
    expect(edited.drainDue(DRAIN_POLICY, later(EDITOR_LIMIT_MS))).toBe(true);
  });

  it('does not drain twice and is never drained once gone', () => {
    const draining = started().drain();

    expect(draining.current).toBe('draining');
    expect(draining.drain()).toBe(draining);
    expect(draining.mustDrain).toBe(true);
    expect(draining.lost(later(1)).drain().current).toBe('gone');
  });

  it('is gone once its host no longer reports it', () => {
    const ready = started().reported();
    const gone = ready.unreported(later(1_000));

    expect(gone.current).toBe('gone');
    expect(gone.goneAt).toEqual(later(1_000));
    expect(gone.isLive).toBe(false);
    expect(started().drain().unreported(later(1)).current).toBe('gone');
  });

  it('gives a starting sandbox a minute before a report without it counts', () => {
    expect(started().unreported(later(59_999)).current).toBe('starting');
    expect(started().unreported(later(60_000)).current).toBe('gone');
  });

  it('is gone when its host goes silent, whatever its state', () => {
    expect(started().lost(later(1)).current).toBe('gone');
    expect(started().reported().drain().lost(later(1)).current).toBe('gone');
  });

  it('cannot be idle while a run holds it', () => {
    expect(() =>
      withLeases([SandboxLease.forRun('run_1', later(0))], later(0)),
    ).toThrow(InconsistentStateError);
    expect(() => withLeases([], null)).toThrow(InconsistentStateError);
  });
});
