import { HookCallbackGrant } from '@integrations/domain/aggregates/hook-callback-grant.aggregate';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-26T10:00:00.000Z');

const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);

const grant = (firing: string | null = 'firing_1') =>
  HookCallbackGrant.issueFor(
    {
      tokenHash: TokenHash.of('a'.repeat(64)),
      workspaceId: WorkspaceId.of('workspace_1'),
      taskId: TaskId.of('task_1'),
      hook: 'dba-review',
      firing,
    },
    NOW,
  );

describe('HookCallbackGrant', () => {
  it('is valid for fifteen minutes from when it is issued', () => {
    expect(grant().expiresAt).toEqual(later(15));
    expect(grant().isValidAt(later(14))).toBe(true);
    expect(grant().isValidAt(later(15))).toBe(false);
  });

  it('has expired once it is no longer valid, so one expiring before the expiry cutoff can be purged', () => {
    const cutoff = HookCallbackGrant.expiredBefore(later(15));

    expect(grant().expiresAt.getTime()).toBeLessThanOrEqual(cutoff.getTime());
    expect(grant().isValidAt(cutoff)).toBe(false);
    expect(HookCallbackGrant.expiredBefore(later(14)).getTime()).toBeLessThan(
      grant().expiresAt.getTime(),
    );
  });

  it('covers its task only within the workspace it was issued in', () => {
    expect(grant().coversTaskIn(WorkspaceId.of('workspace_1'))).toBe(true);
    expect(grant().coversTaskIn(WorkspaceId.of('workspace_2'))).toBe(false);
  });

  it('records a retried note once, by the firing it came from or else by its hook', () => {
    expect(grant().noteIdempotencyKey('note-7')).toBe(
      'callback:task_1:firing_1:note-7',
    );
    expect(grant(null).noteIdempotencyKey('note-7')).toBe(
      'callback:task_1:dba-review:note-7',
    );
    expect(grant().noteIdempotencyKey(null)).toBeNull();
  });

  it('is caused by a callback from its hook', () => {
    expect(grant().causeLink).toEqual({
      kind: 'callback',
      key: 'callback:dba-review:task_1',
      description: 'a note by callback from the hook dba-review',
    });
  });
});
